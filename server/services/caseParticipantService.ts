import { CaseParticipantRecord, ParticipantRole, AuthUserProfile } from '../types';
import { supabaseAdmin } from '../supabase';
import { caseService } from './caseService';
import { auditService } from './auditService';
import { notificationService } from './notificationService';

export interface AddParticipantInput {
  userId: string;
  participantRole: ParticipantRole;
  isPrimary?: boolean;
}

export interface UpdateParticipantInput {
  participantRole?: ParticipantRole;
  isPrimary?: boolean;
}

export class CaseParticipantService {
  /**
   * Helper to verify if calling user is authorized to manage participants for a case
   */
  private async checkCanManageParticipants(
    courtCaseId: string,
    user: AuthUserProfile
  ): Promise<{ caseRecord: any; matter: any }> {
    if (user.role === 'workspace_admin') {
      const { data: cCase, error } = await supabaseAdmin
        .from('court_cases')
        .select('*, matter:matters!matter_id(id, reference_code, lead_attorney_id)')
        .eq('id', courtCaseId)
        .single();

      if (error || !cCase) {
        const err: any = new Error(`Court case not found: ${courtCaseId}`);
        err.statusCode = 404;
        throw err;
      }
      return { caseRecord: cCase, matter: Array.isArray(cCase.matter) ? cCase.matter[0] : cCase.matter };
    }

    const { data: cCase, error } = await supabaseAdmin
      .from('court_cases')
      .select('*, matter:matters!matter_id(id, reference_code, lead_attorney_id)')
      .eq('id', courtCaseId)
      .single();

    if (error || !cCase) {
      const err: any = new Error(`Court case not found: ${courtCaseId}`);
      err.statusCode = 404;
      throw err;
    }

    const matter = Array.isArray(cCase.matter) ? cCase.matter[0] : cCase.matter;
    const isPresidingJudge = cCase.presiding_judge_id === user.id && user.role === 'judge';
    const isLeadAttorney = matter?.lead_attorney_id === user.id && user.role === 'attorney';

    if (!isPresidingJudge && !isLeadAttorney) {
      const err: any = new Error(
        'Access denied: Only workspace admins, presiding judges, or lead attorneys can manage case participants.'
      );
      err.statusCode = 403;
      throw err;
    }

    return { caseRecord: cCase, matter };
  }

  /**
   * Validates that target user profile has a compatible system role for the given participant role
   */
  private validateRoleCompatibility(participantRole: ParticipantRole, systemRole: string): void {
    if (systemRole === 'workspace_admin') {
      return; // Workspace admin is compatible with all administrative/legal assignments
    }

    const normRole = systemRole ? systemRole.toLowerCase() : '';
    switch (participantRole) {
      case 'judge':
        if (normRole !== 'judge') {
          const err: any = new Error(`Role mismatch: Target user system role is "${systemRole}", but participant role "judge" requires system role "judge".`);
          err.statusCode = 400;
          throw err;
        }
        break;
      case 'victim':
        if (normRole !== 'victim') {
          const err: any = new Error(`Role mismatch: Target user system role is "${systemRole}", but participant role "victim" requires system role "victim".`);
          err.statusCode = 400;
          throw err;
        }
        break;
      case 'forensic_examiner':
        if (normRole !== 'forensic_team') {
          const err: any = new Error(`Role mismatch: Target user system role is "${systemRole}", but participant role "forensic_examiner" requires system role "forensic_team".`);
          err.statusCode = 400;
          throw err;
        }
        break;
      case 'prosecutor':
      case 'defense_lawyer':
        if (normRole !== 'attorney' && normRole !== 'lawyer') {
          const err: any = new Error(`Role mismatch: Target user system role is "${systemRole}", but participant role "${participantRole}" requires system role "attorney".`);
          err.statusCode = 400;
          throw err;
        }
        break;
      case 'auditor':
        if (normRole !== 'auditor') {
          const err: any = new Error(`Role mismatch: Target user system role is "${systemRole}", but participant role "auditor" requires system role "auditor".`);
          err.statusCode = 400;
          throw err;
        }
        break;
      case 'investigating_officer':
        // Valid for attorney, forensic_team, or specialized role
        break;
    }
  }

  /**
   * Retrieves participant records for a court case
   */
  async getParticipants(courtCaseId: string, user: AuthUserProfile): Promise<CaseParticipantRecord[]> {
    // 1. Verify user can access the case
    const isAuth = await caseService.isUserAuthorizedForCase(user, courtCaseId);
    if (!isAuth) {
      const err: any = new Error('Access denied: You are not authorized to view participants for this court case.');
      err.statusCode = 403;
      throw err;
    }

    // 2. Query participants
    const { data, error } = await supabaseAdmin
      .from('case_participants')
      .select(`
        id,
        court_case_id,
        matter_id,
        user_id,
        participant_role,
        is_primary,
        assigned_by,
        assigned_at,
        user:profiles!user_id(id, full_name, role)
      `)
      .eq('court_case_id', courtCaseId)
      .order('assigned_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch case participants: ${error.message}`);
    }

    return (data || []).map((row: any) => {
      const u = Array.isArray(row.user) ? row.user[0] : row.user;
      return {
        id: row.id,
        courtCaseId: row.court_case_id,
        matterId: row.matter_id,
        userId: row.user_id,
        userName: u?.full_name || 'Unknown User',
        userRole: u?.role,
        participantRole: row.participant_role as ParticipantRole,
        isPrimary: row.is_primary,
        assignedBy: row.assigned_by,
        assignedAt: row.assigned_at,
      };
    });
  }

  /**
   * Adds a new participant to a court case
   */
  async addParticipant(
    courtCaseId: string,
    input: AddParticipantInput,
    user: AuthUserProfile,
    ipAddress: string = '127.0.0.1'
  ): Promise<CaseParticipantRecord> {
    // 1. Check manager authorization
    const { caseRecord, matter } = await this.checkCanManageParticipants(courtCaseId, user);

    // 2. Fetch target user profile
    const { data: targetProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role, is_active')
      .eq('id', input.userId)
      .single();

    if (profileErr || !targetProfile) {
      const err: any = new Error(`Target user not found: ${input.userId}`);
      err.statusCode = 404;
      throw err;
    }

    if (!targetProfile.is_active) {
      const err: any = new Error('Cannot assign deactivated user to case.');
      err.statusCode = 400;
      throw err;
    }

    // 3. Verify role compatibility
    this.validateRoleCompatibility(input.participantRole, targetProfile.role);

    // 4. Check for existing participant assignment to prevent duplicates
    const { data: existing } = await supabaseAdmin
      .from('case_participants')
      .select('id, participant_role')
      .eq('court_case_id', courtCaseId)
      .eq('user_id', input.userId)
      .limit(1);

    if (existing && existing.length > 0) {
      const err: any = new Error(`User ${targetProfile.full_name} is already assigned to this case as ${existing[0].participant_role}.`);
      err.statusCode = 409;
      throw err;
    }

    // 5. Insert participant record
    // Note: trg_sync_case_participant_to_matter_members automatically synchronizes non-victim participants
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('case_participants')
      .insert([
        {
          court_case_id: courtCaseId,
          matter_id: caseRecord.matter_id,
          user_id: input.userId,
          participant_role: input.participantRole,
          is_primary: input.isPrimary ?? false,
          assigned_by: user.id,
        },
      ])
      .select(`
        id,
        court_case_id,
        matter_id,
        user_id,
        participant_role,
        is_primary,
        assigned_by,
        assigned_at
      `)
      .single();

    if (insertErr || !inserted) {
      throw new Error(`Failed to assign case participant: ${insertErr?.message || 'Database error'}`);
    }

    const result: CaseParticipantRecord = {
      id: inserted.id,
      courtCaseId: inserted.court_case_id,
      matterId: inserted.matter_id,
      userId: inserted.user_id,
      userName: targetProfile.full_name,
      userRole: targetProfile.role,
      participantRole: inserted.participant_role as ParticipantRole,
      isPrimary: inserted.is_primary,
      assignedBy: inserted.assigned_by,
      assignedAt: inserted.assigned_at,
    };

    // 6. Audit log
    await auditService.logEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorInitials: user.initials,
      matterId: caseRecord.matter_id,
      matterReference: matter?.reference_code,
      action: 'matter_updated',
      targetName: caseRecord.case_number,
      details: `Participant added: ${targetProfile.full_name} assigned as ${input.participantRole} to case ${caseRecord.case_number}`,
      ipAddress,
      metadata: {
        courtCaseId,
        participantId: result.id,
        targetUserId: targetProfile.id,
        participantRole: input.participantRole,
        event: 'participant_added',
      },
    }).catch(console.error);

    // 7. Notification to the assigned participant
    await notificationService.createNotification({
      recipientId: targetProfile.id,
      courtCaseId,
      title: 'Case Assignment',
      message: `You have been added to case ${caseRecord.case_number} (${matter?.reference_code}) as ${input.participantRole}.`,
      type: 'case_status_updated',
    }).catch(console.error);

    return result;
  }

  /**
   * Updates an existing participant assignment
   */
  async updateParticipant(
    courtCaseId: string,
    participantId: string,
    updates: UpdateParticipantInput,
    user: AuthUserProfile,
    ipAddress: string = '127.0.0.1'
  ): Promise<CaseParticipantRecord> {
    const { caseRecord, matter } = await this.checkCanManageParticipants(courtCaseId, user);

    // 1. Fetch current participant
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('case_participants')
      .select('*, user:profiles!user_id(id, full_name, role)')
      .eq('id', participantId)
      .eq('court_case_id', courtCaseId)
      .single();

    if (fetchErr || !current) {
      const err: any = new Error(`Participant record not found: ${participantId}`);
      err.statusCode = 404;
      throw err;
    }

    const targetUser = Array.isArray(current.user) ? current.user[0] : current.user;

    // 2. If changing role, validate compatibility
    if (updates.participantRole && updates.participantRole !== current.participant_role) {
      this.validateRoleCompatibility(updates.participantRole, targetUser.role);
    }

    // 3. Update record
    const payload: Record<string, any> = {};
    if (updates.participantRole !== undefined) payload.participant_role = updates.participantRole;
    if (updates.isPrimary !== undefined) payload.is_primary = updates.isPrimary;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('case_participants')
      .update(payload)
      .eq('id', participantId)
      .select()
      .single();

    if (updateErr || !updated) {
      throw new Error(`Failed to update participant: ${updateErr?.message || 'Database error'}`);
    }

    const result: CaseParticipantRecord = {
      id: updated.id,
      courtCaseId: updated.court_case_id,
      matterId: updated.matter_id,
      userId: updated.user_id,
      userName: targetUser?.full_name,
      userRole: targetUser?.role,
      participantRole: updated.participant_role as ParticipantRole,
      isPrimary: updated.is_primary,
      assignedBy: updated.assigned_by,
      assignedAt: updated.assigned_at,
    };

    // 4. Audit log
    await auditService.logEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorInitials: user.initials,
      matterId: caseRecord.matter_id,
      matterReference: matter?.reference_code,
      action: 'matter_updated',
      targetName: caseRecord.case_number,
      details: `Participant role updated: ${targetUser?.full_name} changed from ${current.participant_role} to ${result.participantRole}`,
      ipAddress,
      metadata: {
        courtCaseId,
        participantId,
        previousRole: current.participant_role,
        newRole: result.participantRole,
        event: 'participant_role_changed',
      },
    }).catch(console.error);

    return result;
  }

  /**
   * Removes a participant from a court case
   */
  async removeParticipant(
    courtCaseId: string,
    participantId: string,
    user: AuthUserProfile,
    ipAddress: string = '127.0.0.1'
  ): Promise<void> {
    const { caseRecord, matter } = await this.checkCanManageParticipants(courtCaseId, user);

    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('case_participants')
      .select('*, user:profiles!user_id(id, full_name)')
      .eq('id', participantId)
      .eq('court_case_id', courtCaseId)
      .single();

    if (fetchErr || !current) {
      const err: any = new Error(`Participant not found: ${participantId}`);
      err.statusCode = 404;
      throw err;
    }

    const targetUser = Array.isArray(current.user) ? current.user[0] : current.user;

    const { error: deleteErr } = await supabaseAdmin
      .from('case_participants')
      .delete()
      .eq('id', participantId);

    if (deleteErr) {
      throw new Error(`Failed to delete participant: ${deleteErr.message}`);
    }

    await auditService.logEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorInitials: user.initials,
      matterId: caseRecord.matter_id,
      matterReference: matter?.reference_code,
      action: 'matter_updated',
      targetName: caseRecord.case_number,
      details: `Participant removed: ${targetUser?.full_name} (${current.participant_role}) removed from case ${caseRecord.case_number}`,
      ipAddress,
      metadata: {
        courtCaseId,
        participantId,
        removedUserId: current.user_id,
        participantRole: current.participant_role,
        event: 'participant_removed',
      },
    }).catch(console.error);
  }
}

export const caseParticipantService = new CaseParticipantService();
