import { NotificationRecord, NotificationType, AuthUserProfile } from '../types';
import { supabaseAdmin } from '../supabase';

export class NotificationService {
  /**
   * Retrieves notifications for an authenticated user.
   */
  async getUserNotifications(user: AuthUserProfile, options: { unreadOnly?: boolean; limit?: number } = {}): Promise<NotificationRecord[]> {
    let query = supabaseAdmin
      .from('notifications')
      .select('id, recipient_id, court_case_id, title, message, type, is_read, created_at')
      .order('created_at', { ascending: false });

    // Workspace admin can see all if explicitly requested, but by default gets their own
    query = query.eq('recipient_id', user.id);

    if (options.unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (options.limit && options.limit > 0) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(100);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to fetch notifications:', error.message);
      throw new Error(`Database error fetching notifications: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      recipientId: row.recipient_id,
      courtCaseId: row.court_case_id,
      title: row.title,
      message: row.message,
      type: row.type,
      isRead: row.is_read,
      createdAt: row.created_at,
    }));
  }

  /**
   * Marks a notification as read.
   * Enforces that the notification belongs to the calling user (or user is workspace_admin).
   */
  async markAsRead(notificationId: string, user: AuthUserProfile): Promise<NotificationRecord> {
    // 1. Fetch notification to verify ownership
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('notifications')
      .select('id, recipient_id, court_case_id, title, message, type, is_read, created_at')
      .eq('id', notificationId)
      .single();

    if (fetchErr || !existing) {
      const err: any = new Error('Notification not found');
      err.statusCode = 404;
      throw err;
    }

    // Ownership check: users can only mark their own notification as read
    if (existing.recipient_id !== user.id && user.role !== 'workspace_admin') {
      const err: any = new Error('Access denied: You cannot modify notifications belonging to another user.');
      err.statusCode = 403;
      throw err;
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .select()
      .single();

    if (updateErr || !updated) {
      throw new Error(`Failed to update notification: ${updateErr?.message || 'Unknown database error'}`);
    }

    return {
      id: updated.id,
      recipientId: updated.recipient_id,
      courtCaseId: updated.court_case_id,
      title: updated.title,
      message: updated.message,
      type: updated.type,
      isRead: updated.is_read,
      createdAt: updated.created_at,
    };
  }

  /**
   * Internal/Service helper to create a verified notification for a user.
   */
  async createNotification(params: {
    recipientId: string;
    courtCaseId?: string | null;
    title: string;
    message: string;
    type: NotificationType;
  }): Promise<NotificationRecord> {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert([
        {
          recipient_id: params.recipientId,
          court_case_id: params.courtCaseId || null,
          title: params.title,
          message: params.message,
          type: params.type,
          is_read: false,
        },
      ])
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to create notification:', error?.message);
      throw new Error(`Failed to create notification: ${error?.message || 'Unknown error'}`);
    }

    return {
      id: data.id,
      recipientId: data.recipient_id,
      courtCaseId: data.court_case_id,
      title: data.title,
      message: data.message,
      type: data.type,
      isRead: data.is_read,
      createdAt: data.created_at,
    };
  }

  /**
   * Broadcasts a notification to all active case participants and presiding judge.
   */
  async notifyCaseParticipants(
    courtCaseId: string,
    params: {
      title: string;
      message: string;
      type: NotificationType;
      excludeUserId?: string;
    }
  ): Promise<void> {
    try {
      // 1. Fetch case to check presiding judge
      const { data: caseRow } = await supabaseAdmin
        .from('court_cases')
        .select('presiding_judge_id')
        .eq('id', courtCaseId)
        .single();

      // 2. Fetch all participants for this case
      const { data: participants } = await supabaseAdmin
        .from('case_participants')
        .select('user_id')
        .eq('court_case_id', courtCaseId);

      const recipientSet = new Set<string>();

      if (caseRow?.presiding_judge_id) {
        recipientSet.add(caseRow.presiding_judge_id);
      }

      (participants || []).forEach((p: any) => {
        if (p.user_id) recipientSet.add(p.user_id);
      });

      if (params.excludeUserId) {
        recipientSet.delete(params.excludeUserId);
      }

      const promises = Array.from(recipientSet).map((userId) =>
        this.createNotification({
          recipientId: userId,
          courtCaseId,
          title: params.title,
          message: params.message,
          type: params.type,
        }).catch((err) => console.warn(`Failed to notify participant ${userId}:`, err.message))
      );

      await Promise.all(promises);
    } catch (err: any) {
      console.warn('Error in notifyCaseParticipants:', err.message);
    }
  }

  /**
   * Broadcasts a notification to a specific list of user IDs.
   */
  async notifyUsers(
    userIds: string[],
    params: {
      courtCaseId?: string | null;
      title: string;
      message: string;
      type: NotificationType;
    }
  ): Promise<void> {
    const promises = userIds.map((userId) =>
      this.createNotification({
        recipientId: userId,
        courtCaseId: params.courtCaseId,
        title: params.title,
        message: params.message,
        type: params.type,
      }).catch((err) => console.warn(`Failed to notify user ${userId}:`, err.message))
    );
    await Promise.all(promises);
  }
}

export const notificationService = new NotificationService();
