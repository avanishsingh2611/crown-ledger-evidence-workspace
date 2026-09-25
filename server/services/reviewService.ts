import { ReviewRecord, DocumentReviewStatus, AuthUserProfile } from '../types';
import { supabaseAdmin } from '../supabase';
import { documentService } from './documentService';
import { auditService } from './auditService';

export class ReviewService {
  /**
   * Get all review records across documents from Supabase PostgreSQL
   */
  async getAllReviews(filter?: { documentId?: string; status?: string }): Promise<ReviewRecord[]> {
    let query = supabaseAdmin
      .from('reviews')
      .select(`
        id,
        document_id,
        document_version_id,
        assigned_to,
        requested_by,
        status,
        decision_notes,
        completed_at,
        created_at,
        assignee:profiles!assigned_to (
          id,
          full_name
        ),
        requester:profiles!requested_by (
          id,
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    if (filter?.documentId) {
      query = query.eq('document_id', filter.documentId);
    }
    if (filter?.status) {
      query = query.eq('status', filter.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch reviews from Supabase:', error.message);
      throw new Error(`Database error fetching reviews: ${error.message}`);
    }

    if (!data) return [];

    return data.map((r: any) => ({
      id: r.id,
      documentId: r.document_id,
      documentVersionId: r.document_version_id,
      assignedToId: r.assigned_to,
      assignedToName: r.assignee?.full_name || 'Assigned Reviewer',
      requestedById: r.requested_by,
      requestedByName: r.requester?.full_name || 'Authorized Member',
      status: r.status,
      decisionNotes: r.decision_notes,
      completedAt: r.completed_at,
      createdAt: r.created_at,
    }));
  }

  /**
   * Submit or complete a review for a document in Supabase PostgreSQL
   */
  async submitReview(params: {
    documentId: string;
    reviewer: AuthUserProfile;
    status: DocumentReviewStatus;
    decisionNotes: string;
  }): Promise<{ reviewRecord: ReviewRecord; documentTitle: string } | null> {
    const doc = await documentService.getDocumentById(params.documentId);
    if (!doc) return null;

    const workflowStatus = params.status === 'reviewed' ? 'completed' : 'in_progress';

    const { data: newRev, error } = await supabaseAdmin
      .from('reviews')
      .insert([
        {
          document_id: doc.id,
          document_version_id: doc.currentVersion.id,
          assigned_to: params.reviewer.id,
          requested_by: doc.createdBy,
          status: workflowStatus,
          decision_notes: params.decisionNotes,
          completed_at: params.status === 'reviewed' ? new Date().toISOString() : null,
        },
      ])
      .select(`
        id,
        document_id,
        document_version_id,
        assigned_to,
        requested_by,
        status,
        decision_notes,
        completed_at,
        created_at,
        assignee:profiles!assigned_to (
          id,
          full_name
        ),
        requester:profiles!requested_by (
          id,
          full_name
        )
      `)
      .single();

    if (error || !newRev) {
      console.error(`Failed to insert review record for document ${doc.id}:`, error?.message);
      throw new Error(`Database error recording review: ${error?.message || 'Insert failed'}`);
    }

    const assignee = Array.isArray((newRev as any)?.assignee)
      ? (newRev as any).assignee[0]
      : (newRev as any)?.assignee;
    const requester = Array.isArray((newRev as any)?.requester)
      ? (newRev as any).requester[0]
      : (newRev as any)?.requester;

    const reviewRecord: ReviewRecord = {
      id: newRev.id,
      documentId: newRev.document_id,
      documentVersionId: newRev.document_version_id,
      assignedToId: newRev.assigned_to,
      assignedToName: assignee?.full_name || params.reviewer.fullName,
      requestedById: newRev.requested_by,
      requestedByName: requester?.full_name || doc.creatorName,
      status: newRev.status,
      decisionNotes: newRev.decision_notes,
      completedAt: newRev.completed_at,
      createdAt: newRev.created_at,
    };

    // Update document review_status in PostgreSQL
    await documentService.updateReviewStatus(doc.id, params.status, reviewRecord);

    // Append-only audit logging
    await auditService.logEvent({
      actorId: params.reviewer.id,
      actorName: params.reviewer.fullName,
      actorInitials: params.reviewer.initials,
      matterId: doc.matterId,
      matterReference: doc.matterReference,
      documentId: doc.id,
      action: 'review_completed',
      targetName: doc.title,
      details: `${params.decisionNotes} · Status: ${params.status} (${params.reviewer.fullName})`,
      metadata: { reviewStatus: params.status, version: doc.currentVersionNumber },
    });

    return { reviewRecord, documentTitle: doc.title };
  }
}

export const reviewService = new ReviewService();
