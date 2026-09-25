import {
  RestrictedAccessRequestRecord,
  RestrictedAccessStatus,
  AuthUserProfile,
  DocumentRecord,
} from '../types';
import { supabaseAdmin } from '../supabase';
import { documentService } from './documentService';
import { matterService } from './matterService';
import { auditService } from './auditService';

export class RestrictedAccessService {
  /**
   * Check if a user has clearance to access/download a specific document
   */
  async checkUserDocumentAccess(
    user: AuthUserProfile,
    doc: DocumentRecord
  ): Promise<{
    hasAccess: boolean;
    isRestricted: boolean;
    accessRequestStatus: RestrictedAccessStatus | 'none';
    approvedUntil?: string | null;
    reason?: string;
  }> {
    // 1. Check if document is restricted / confidential / privileged
    const isRestricted =
      doc.classification === 'restricted' ||
      doc.classification === 'confidential' ||
      doc.classification === 'privileged' ||
      doc.reviewStatus === 'restricted';

    if (!isRestricted) {
      return {
        hasAccess: true,
        isRestricted: false,
        accessRequestStatus: 'none',
        approvedUntil: null,
      };
    }

    // 2. Managing Partner / Workspace Admin has global clearance
    if (user.role === 'workspace_admin') {
      return {
        hasAccess: true,
        isRestricted: true,
        accessRequestStatus: 'approved',
        approvedUntil: null,
      };
    }

    // 3. Document creator/uploader has inherent access
    if (doc.createdBy === user.id) {
      return {
        hasAccess: true,
        isRestricted: true,
        accessRequestStatus: 'approved',
        approvedUntil: null,
      };
    }

    // 4. Lead attorney on the matter has inherent access
    const matter = await matterService.getMatterById(doc.matterId);
    if (matter && matter.leadAttorneyId === user.id) {
      return {
        hasAccess: true,
        isRestricted: true,
        accessRequestStatus: 'approved',
        approvedUntil: null,
      };
    }

    // 5. Query public.restricted_access_requests in Supabase for approved clearance
    try {
      const { data: requests, error } = await supabaseAdmin
        .from('restricted_access_requests')
        .select('id, status, decision_note, approved_until')
        .eq('document_id', doc.id)
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn('Failed to query restricted_access_requests:', error.message);
      }

      if (requests && requests.length > 0) {
        const latest = requests[0];
        if (latest.status === 'approved') {
          if (latest.approved_until && new Date(latest.approved_until).getTime() < Date.now()) {
            return {
              hasAccess: false,
              isRestricted: true,
              accessRequestStatus: 'denied',
              approvedUntil: latest.approved_until,
              reason: `Clearance expired on ${new Date(latest.approved_until).toISOString()}. Please submit a renewed access request.`,
            };
          }
          return {
            hasAccess: true,
            isRestricted: true,
            accessRequestStatus: 'approved',
            approvedUntil: latest.approved_until || null,
          };
        }
        if (latest.status === 'pending') {
          return {
            hasAccess: false,
            isRestricted: true,
            accessRequestStatus: 'pending',
            reason: 'Clearance request is currently pending review by Lead Counsel.',
          };
        }
        if (latest.status === 'denied') {
          return {
            hasAccess: false,
            isRestricted: true,
            accessRequestStatus: 'denied',
            reason: latest.decision_note
              ? `Clearance request denied: "${latest.decision_note}"`
              : 'Clearance request was denied by Lead Counsel.',
          };
        }
      }
    } catch (err: any) {
      console.error('Error checking restricted access request:', err);
    }

    return {
      hasAccess: false,
      isRestricted: true,
      accessRequestStatus: 'none',
      reason: `Access to restricted/confidential document "${doc.title}" requires Managing Partner or Lead Attorney clearance.`,
    };
  }

  /**
   * Submit an access request for a restricted document
   */
  async createRequest(params: {
    documentId: string;
    requester: AuthUserProfile;
    reason: string;
  }): Promise<RestrictedAccessRequestRecord> {
    const doc = await documentService.getDocumentById(params.documentId);
    if (!doc) {
      throw new Error(`Document ${params.documentId} not found`);
    }

    // Verify matter access for the requester (ethical wall protection)
    const hasMatterAccess = await matterService.checkUserMatterAccess(params.requester.id, doc.matterId);
    if (!hasMatterAccess && params.requester.role !== 'workspace_admin') {
      const err: any = new Error('Access denied: You are not assigned to the matter associated with this document.');
      err.statusCode = 403;
      throw err;
    }

    // Verify document is actually restricted / confidential
    const isRestricted =
      doc.classification === 'restricted' ||
      doc.classification === 'confidential' ||
      doc.classification === 'privileged' ||
      doc.reviewStatus === 'restricted';

    if (!isRestricted) {
      const err: any = new Error('This document is not restricted or confidential. General matter access applies.');
      err.statusCode = 400;
      throw err;
    }

    // Check if an active pending request already exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('restricted_access_requests')
      .select('id, status')
      .eq('document_id', doc.id)
      .eq('requester_id', params.requester.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (checkError) {
      console.warn('Warning checking existing request:', checkError.message);
    }

    if (existing) {
      const err: any = new Error('A clearance request for this document is already pending review.');
      err.statusCode = 409;
      throw err;
    }

    // Insert new request
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('restricted_access_requests')
      .insert([
        {
          document_id: doc.id,
          requester_id: params.requester.id,
          matter_id: doc.matterId,
          reason: params.reason.trim(),
          status: 'pending',
        },
      ])
      .select(`
        id,
        document_id,
        requester_id,
        matter_id,
        reason,
        status,
        reviewer_id,
        decision_note,
        created_at,
        decided_at
      `)
      .single();

    if (insertError || !inserted) {
      console.error('Failed to create restricted_access_request in Supabase:', insertError?.message);
      throw new Error(`Database error submitting request: ${insertError?.message || 'Insert failed'}`);
    }

    // Append-only audit logging
    await auditService.logEvent({
      actorId: params.requester.id,
      actorName: params.requester.fullName,
      actorInitials: params.requester.initials,
      matterId: doc.matterId,
      matterReference: doc.matterReference,
      documentId: doc.id,
      action: 'review_requested',
      targetName: doc.title,
      details: `Restricted clearance requested by ${params.requester.fullName} (${params.requester.title}) · Reason: ${params.reason.trim()}`,
      metadata: {
        requestId: inserted.id,
        classification: doc.classification,
      },
    }).catch(console.error);

    return {
      id: inserted.id,
      documentId: inserted.document_id,
      documentTitle: doc.title,
      requesterId: inserted.requester_id,
      requesterName: params.requester.fullName,
      requesterEmail: params.requester.email,
      matterId: inserted.matter_id,
      matterReference: doc.matterReference,
      matterTitle: doc.matterTitle,
      classification: doc.classification,
      reason: inserted.reason,
      status: inserted.status as RestrictedAccessStatus,
      reviewerId: inserted.reviewer_id,
      decisionNote: inserted.decision_note,
      createdAt: inserted.created_at,
      decidedAt: inserted.decided_at,
    };
  }

  /**
   * Get all restricted access requests with optional status/matter filtering
   */
  async getRequests(
    filters?: { status?: string; matterId?: string },
    user?: AuthUserProfile
  ): Promise<RestrictedAccessRequestRecord[]> {
    let query = supabaseAdmin
      .from('restricted_access_requests')
      .select(`
        id,
        document_id,
        requester_id,
        matter_id,
        reason,
        status,
        reviewer_id,
        decision_note,
        approved_until,
        created_at,
        decided_at,
        document:documents!document_id (
          id,
          title,
          classification
        ),
        matter:matters!matter_id (
          id,
          reference_code,
          title,
          lead_attorney_id
        ),
        requester:profiles!requester_id (
          id,
          full_name,
          email
        ),
        reviewer:profiles!reviewer_id (
          id,
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters?.matterId && filters.matterId !== 'all') {
      query = query.eq('matter_id', filters.matterId);
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error('Failed to query restricted_access_requests from Supabase:', error.message);
      throw new Error(`Database error fetching access requests: ${error.message}`);
    }

    if (!rows) return [];

    let adapted = rows.map((r: any) => {
      const doc = Array.isArray(r.document) ? r.document[0] : r.document;
      const matter = Array.isArray(r.matter) ? r.matter[0] : r.matter;
      const requester = Array.isArray(r.requester) ? r.requester[0] : r.requester;
      const reviewer = Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer;

      return {
        id: r.id,
        documentId: r.document_id,
        documentTitle: doc?.title || 'Confidential Document',
        classification: doc?.classification || 'confidential',
        requesterId: r.requester_id,
        requesterName: requester?.full_name || 'Counsel Member',
        requesterEmail: requester?.email || '',
        matterId: r.matter_id,
        matterReference: matter?.reference_code || '',
        matterTitle: matter?.title || '',
        reason: r.reason,
        status: r.status as RestrictedAccessStatus,
        reviewerId: r.reviewer_id,
        reviewerName: reviewer?.full_name || null,
        decisionNote: r.decision_note,
        approvedUntil: r.approved_until || null,
        createdAt: r.created_at,
        decidedAt: r.decided_at,
        leadAttorneyId: matter?.lead_attorney_id,
      };
    });

    // Enforce authorization visibility: Admins can view all; Lead Attorneys can view for their matters;
    // other counsel can view requests they submitted
    if (user && user.role !== 'workspace_admin' && user.role !== 'auditor') {
      adapted = adapted.filter(
        (req: any) => req.requesterId === user.id || req.leadAttorneyId === user.id
      );
    }

    return adapted;
  }

  /**
   * Decide (approve or deny) a restricted access request
   */
  async decideRequest(params: {
    requestId: string;
    reviewer: AuthUserProfile;
    decision: 'approved' | 'denied';
    decisionNote: string;
    approvedUntil?: string;
  }): Promise<RestrictedAccessRequestRecord> {
    // 1. Fetch existing request
    const { data: request, error: fetchErr } = await supabaseAdmin
      .from('restricted_access_requests')
      .select(`
        id,
        document_id,
        requester_id,
        matter_id,
        reason,
        status,
        document:documents!document_id (
          id,
          title,
          classification
        ),
        matter:matters!matter_id (
          id,
          reference_code,
          title,
          lead_attorney_id
        )
      `)
      .eq('id', params.requestId)
      .single();

    if (fetchErr || !request) {
      const err: any = new Error(`Access request ${params.requestId} not found`);
      err.statusCode = 404;
      throw err;
    }

    if (request.status !== 'pending') {
      const err: any = new Error(`Request is already ${request.status}. Cannot re-decide.`);
      err.statusCode = 400;
      throw err;
    }

    // 2. Requester cannot approve their own request! (TASK 12 #6)
    if (request.requester_id === params.reviewer.id) {
      const err: any = new Error('Unauthorized: Requesters cannot approve or deny their own access requests.');
      err.statusCode = 403;
      throw err;
    }

    // 3. Reviewer must be Workspace Admin or Matter Lead Attorney
    const matter = Array.isArray(request.matter) ? request.matter[0] : request.matter;
    const isLeadOrAdmin =
      params.reviewer.role === 'workspace_admin' ||
      (matter && matter.lead_attorney_id === params.reviewer.id);

    if (!isLeadOrAdmin) {
      const err: any = new Error('Unauthorized: Only Workspace Administrators or Lead Counsel can decide clearance requests.');
      err.statusCode = 403;
      throw err;
    }

    // 4. Decision note is strictly required
    if (!params.decisionNote || params.decisionNote.trim().length < 3) {
      const err: any = new Error('Decision notes are mandatory for custodial compliance audit.');
      err.statusCode = 400;
      throw err;
    }

    const decidedAt = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      status: params.decision,
      reviewer_id: params.reviewer.id,
      decision_note: params.decisionNote.trim(),
      decided_at: decidedAt,
    };
    if (params.decision === 'approved' && params.approvedUntil) {
      updatePayload.approved_until = params.approvedUntil;
    }

    // 5. Update status in Supabase PostgreSQL
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('restricted_access_requests')
      .update(updatePayload)
      .eq('id', params.requestId)
      .select()
      .single();

    if (updateErr || !updated) {
      console.error('Failed to update restricted_access_request:', updateErr?.message);
      throw new Error(`Database error updating request: ${updateErr?.message}`);
    }

    const doc = Array.isArray(request.document) ? request.document[0] : request.document;

    // 6. Audit logging for custodial compliance (TASK 7 & TASK 12 #9)
    await auditService.logEvent({
      actorId: params.reviewer.id,
      actorName: params.reviewer.fullName,
      actorInitials: params.reviewer.initials,
      matterId: request.matter_id,
      matterReference: matter?.reference_code,
      documentId: request.document_id,
      action: 'review_completed',
      targetName: doc?.title || 'Restricted Evidence',
      details: `Restricted access ${params.decision.toUpperCase()} by ${params.reviewer.fullName} (${params.reviewer.title}) · Decision note: ${params.decisionNote.trim()}${params.approvedUntil ? ` · Clearance valid until: ${params.approvedUntil}` : ''}`,
      metadata: {
        requestId: request.id,
        decision: params.decision,
        requesterId: request.requester_id,
        approvedUntil: params.approvedUntil || null,
      },
    }).catch(console.error);

    return {
      id: updated.id,
      documentId: updated.document_id,
      documentTitle: doc?.title || 'Confidential Document',
      classification: doc?.classification || 'confidential',
      requesterId: updated.requester_id,
      matterId: updated.matter_id,
      matterReference: matter?.reference_code || '',
      matterTitle: matter?.title || '',
      reason: updated.reason,
      status: updated.status as RestrictedAccessStatus,
      reviewerId: updated.reviewer_id,
      reviewerName: params.reviewer.fullName,
      decisionNote: updated.decision_note,
      approvedUntil: updated.approved_until || null,
      createdAt: updated.created_at,
      decidedAt: updated.decided_at,
    };
  }
}

export const restrictedAccessService = new RestrictedAccessService();
