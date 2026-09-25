import crypto from 'crypto';
import { AuditLogRecord, DownloadSecurityEventRecord, AuditActionType, AuthUserProfile } from '../types';
import { supabaseAdmin } from '../supabase';
import { matterService } from './matterService';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

/**
 * Maps application action strings to PostgreSQL `audit_action_type` enum values:
 * 'uploaded' | 'review_requested' | 'accessed' | 'classification_changed' |
 * 'review_completed' | 'matter_created' | 'matter_updated' | 'downloaded'
 */
function normalizeAuditAction(action: AuditActionType): string {
  switch (action) {
    case 'uploaded':
    case 'version_bumped':
      return 'UPLOAD_EVIDENCE';
    case 'downloaded':
    case 'accessed':
    case 'security_alert':
    case 'access_requested':
    case 'access_approved':
    case 'access_denied':
    case 'audit_exported':
      return 'DOWNLOAD_DOCUMENT';
    case 'matter_created':
    case 'matter_updated':
      return 'UPDATE_CASE';
    case 'classified':
    case 'classification_changed':
    case 'review_requested':
    case 'review_completed':
      return 'UPDATE_EVIDENCE';
    default:
      return 'UPLOAD_EVIDENCE';
  }
}

function denormalizeAuditAction(action: string): AuditActionType {
  switch (action) {
    case 'UPLOAD_EVIDENCE':
      return 'uploaded';
    case 'DOWNLOAD_DOCUMENT':
      return 'downloaded';
    case 'UPDATE_EVIDENCE':
      return 'classification_changed';
    case 'UPDATE_CASE':
      return 'matter_updated';
    default:
      return (action?.toLowerCase() || 'accessed') as AuditActionType;
  }
}

export class AuditService {
  /**
   * Strictly append-only logging of an audit event to Supabase PostgreSQL
   */
  async logEvent(params: {
    actorId: string;
    actorName: string;
    actorInitials: string;
    matterId?: string;
    matterReference?: string;
    documentId?: string;
    action: AuditActionType;
    targetName: string;
    details: string;
    ipAddress?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditLogRecord> {
    const dbAction = normalizeAuditAction(params.action);
    const validMatterId = isValidUuid(params.matterId) ? params.matterId : null;
    const validDocumentId = isValidUuid(params.documentId) ? params.documentId : null;

    const payload: Record<string, any> = {
      actor_id: params.actorId,
      action: dbAction,
      target_name: params.targetName,
      details: params.details,
      metadata: {
        ...(params.metadata || {}),
        originalAction: params.action,
        matterReference: params.matterReference,
        ipAddress: params.ipAddress || '127.0.0.1',
      },
    };

    if (validMatterId) payload.matter_id = validMatterId;
    if (validDocumentId) payload.document_id = validDocumentId;

    const { data: inserted, error } = await supabaseAdmin
      .from('audit_logs')
      .insert([payload])
      .select(`
        id,
        actor_id,
        matter_id,
        document_id,
        action,
        target_name,
        details,
        metadata,
        created_at,
        actor:profiles!actor_id (
          id,
          full_name,
          initials
        ),
        matter:matters!matter_id (
          id,
          reference_code
        )
      `)
      .single();

    if (error || !inserted) {
      console.error('Failed to write to public.audit_logs in Supabase:', error?.message);
      // For security audit compliance, bubble the error if critical
      throw new Error(`Audit log insertion failed: ${error?.message || 'Database error'}`);
    }

    const actor = Array.isArray((inserted as any)?.actor)
      ? (inserted as any).actor[0]
      : (inserted as any)?.actor;
    const matter = Array.isArray((inserted as any)?.matter)
      ? (inserted as any).matter[0]
      : (inserted as any)?.matter;

    return {
      id: inserted.id,
      actorId: inserted.actor_id,
      actorName: actor?.full_name || params.actorName,
      actorInitials: actor?.initials || params.actorInitials,
      matterId: inserted.matter_id,
      matterReference: matter?.reference_code || params.matterReference || '',
      documentId: inserted.document_id,
      action: (params.action || denormalizeAuditAction(inserted.action)) as AuditActionType,
      targetName: inserted.target_name,
      details: inserted.details,
      ipAddress: params.ipAddress || '127.0.0.1',
      metadata: inserted.metadata || {},
      createdAt: inserted.created_at,
    };
  }

  /**
   * Log download security event to public.download_security_events in Supabase PostgreSQL
   */
  async logDownloadEvent(params: {
    documentId: string;
    documentTitle: string;
    versionNumber: number;
    userId: string;
    userName: string;
    matterReference: string;
    signedUrlExpiresAt: string;
    ipAddress?: string;
  }): Promise<DownloadSecurityEventRecord> {
    // 1. Resolve document and version IDs from database
    const { data: docData, error: docError } = await supabaseAdmin
      .from('documents')
      .select(`
        id,
        matter_id,
        versions:document_versions (
          id,
          version_number
        )
      `)
      .eq('id', params.documentId)
      .single();

    if (docError || !docData) {
      console.error('Failed to resolve document for download security event:', docError?.message);
      throw new Error(`Cannot record download event: document ${params.documentId} not found`);
    }

    const version = (docData.versions || []).find((v: any) => v.version_number === params.versionNumber);
    if (!version) {
      throw new Error(`Version ${params.versionNumber} for document ${params.documentId} not found`);
    }

    // 2. Insert into public.download_security_events
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('download_security_events')
      .insert([
        {
          document_id: docData.id,
          document_version_id: version.id,
          user_id: params.userId,
          matter_id: docData.matter_id,
          action_type: 'signed_url_generated',
          ip_address: params.ipAddress || '127.0.0.1',
          signed_url_expires_at: params.signedUrlExpiresAt,
          download_verified: true,
          metadata: {
            documentTitle: params.documentTitle,
            matterReference: params.matterReference,
          },
        },
      ])
      .select()
      .single();

    if (insertError || !inserted) {
      console.error('Failed to insert download security event:', insertError?.message);
      throw new Error(`Database error logging download security event: ${insertError?.message || 'Insert failed'}`);
    }

    return {
      id: inserted.id,
      documentId: inserted.document_id,
      documentTitle: params.documentTitle,
      versionNumber: params.versionNumber,
      userId: inserted.user_id,
      userName: params.userName,
      matterReference: params.matterReference,
      actionType: inserted.action_type || 'signed_url_generated',
      signedUrlExpiresAt: inserted.signed_url_expires_at,
      downloadVerified: inserted.download_verified,
      ipAddress: inserted.ip_address,
      createdAt: inserted.created_at,
    };
  }

  /**
   * Get all audit logs with optional filters from Supabase PostgreSQL
   */
  async getAuditLogs(filters?: {
    matterId?: string;
    documentId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AuditLogRecord[]; total: number }> {
    let query = supabaseAdmin
      .from('audit_logs')
      .select(`
        id,
        actor_id,
        matter_id,
        document_id,
        action,
        target_name,
        details,
        metadata,
        created_at,
        actor:profiles!actor_id (
          id,
          full_name,
          initials
        ),
        matter:matters!matter_id (
          id,
          reference_code
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters?.matterId && filters.matterId !== 'all') {
      query = query.eq('matter_id', filters.matterId);
    }
    if (filters?.documentId) {
      query = query.eq('document_id', filters.documentId);
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('Failed to query public.audit_logs from Supabase:', error.message);
      throw new Error(`Database error retrieving audit logs: ${error.message}`);
    }

    if (!data) return { data: [], total: 0 };

    const records: AuditLogRecord[] = data.map((log: any) => ({
      id: log.id,
      actorId: log.actor_id,
      actorName: log.actor?.full_name || 'Authorized Member',
      actorInitials: log.actor?.initials || 'AM',
      matterId: log.matter_id,
      matterReference: log.matter?.reference_code || log.metadata?.matterReference || '',
      documentId: log.document_id,
      action: (log.metadata?.originalAction || denormalizeAuditAction(log.action)) as AuditActionType,
      targetName: log.target_name,
      details: log.details,
      ipAddress: log.metadata?.ipAddress || '127.0.0.1',
      metadata: log.metadata || {},
      createdAt: log.created_at,
    }));

    return { data: records, total: count || records.length };
  }

  /**
   * Get download security events from Supabase PostgreSQL
   */
  async getDownloadEvents(): Promise<DownloadSecurityEventRecord[]> {
    const { data, error } = await supabaseAdmin
      .from('download_security_events')
      .select(`
        id,
        document_id,
        document_version_id,
        user_id,
        matter_id,
        action_type,
        ip_address,
        signed_url_expires_at,
        download_verified,
        metadata,
        created_at,
        document:documents!document_id (
          title
        ),
        version:document_versions!document_version_id (
          version_number
        ),
        user:profiles!user_id (
          full_name
        ),
        matter:matters!matter_id (
          reference_code
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch download security events from Supabase:', error.message);
      throw new Error(`Database error fetching download events: ${error.message}`);
    }

    if (!data) return [];

    return data.map((evt: any) => ({
      id: evt.id,
      documentId: evt.document_id,
      documentTitle: evt.document?.title || evt.metadata?.documentTitle || 'Evidence Document',
      versionNumber: evt.version?.version_number || 1,
      userId: evt.user_id,
      userName: evt.user?.full_name || 'Authorized Member',
      matterReference: evt.matter?.reference_code || evt.metadata?.matterReference || '',
      actionType: evt.action_type || 'signed_url_generated',
      signedUrlExpiresAt: evt.signed_url_expires_at,
      downloadVerified: evt.download_verified,
      ipAddress: evt.ip_address,
      createdAt: evt.created_at,
    }));
  }

  /**
   * Export audit logs in CSV or JSON format with cryptographic integrity hash and append-only export audit event
   */
  async exportAuditLogs(params: {
    actor: AuthUserProfile;
    matterId?: string;
    format: 'csv' | 'json';
    ipAddress?: string;
  }): Promise<{
    content: string;
    format: 'csv' | 'json';
    filename: string;
    recordCount: number;
    integrityHash: string;
    exportedAt: string;
  }> {
    // 1. Role & matter authorization check
    if (params.actor.role !== 'workspace_admin' && params.actor.role !== 'auditor') {
      if (!params.matterId || params.matterId === 'all') {
        const err: any = new Error('Unauthorized: Counsel cannot export firm-wide audit logs. A matter ID is required.');
        err.statusCode = 403;
        throw err;
      }
      const hasMatterAccess = await matterService.checkUserMatterAccess(params.actor.id, params.matterId);
      if (!hasMatterAccess) {
        const err: any = new Error('Access denied: You are not assigned to the matter associated with this audit export.');
        err.statusCode = 403;
        throw err;
      }
    }

    // 2. Query logs from public.audit_logs
    let query = supabaseAdmin
      .from('audit_logs')
      .select(`
        id,
        actor_id,
        matter_id,
        document_id,
        action,
        target_name,
        details,
        metadata,
        created_at,
        actor:profiles!actor_id (
          id,
          full_name,
          initials
        ),
        matter:matters!matter_id (
          id,
          reference_code,
          title
        )
      `)
      .order('created_at', { ascending: false });

    if (params.matterId && params.matterId !== 'all') {
      query = query.eq('matter_id', params.matterId);
    }

    const { data: rawLogs, error } = await query;
    if (error) {
      console.error('Database error fetching audit records for export:', error.message);
      throw new Error(`Database error fetching audit records: ${error.message}`);
    }

    const logs = rawLogs || [];
    const exportTimestamp = new Date().toISOString();

    // 3. Format sanitized records (strict exclusion of secrets or credentials)
    const records = logs.map((log: any) => {
      const actor = Array.isArray(log.actor) ? log.actor[0] : log.actor;
      const matter = Array.isArray(log.matter) ? log.matter[0] : log.matter;
      return {
        id: log.id,
        timestamp: log.created_at,
        actorId: log.actor_id,
        actorName: actor?.full_name || 'Authorized Member',
        actorInitials: actor?.initials || 'AM',
        action: log.action,
        matterId: log.matter_id || '',
        matterReference: matter?.reference_code || log.metadata?.matterReference || '',
        matterTitle: matter?.title || '',
        documentId: log.document_id || '',
        targetName: log.target_name || '',
        details: log.details || '',
        ipAddress: log.metadata?.ipAddress || log.ip_address || '127.0.0.1',
      };
    });

    let content = '';
    const datePrefix = exportTimestamp.slice(0, 10);
    const filename = `crown-ledger-audit-export-${params.matterId ? params.matterId.slice(0, 8) + '-' : ''}${datePrefix}.${params.format}`;

    if (params.format === 'json') {
      // Calculate integrity hash of the records
      const canonicalJson = JSON.stringify(records);
      const integrityHash = crypto.createHash('sha256').update(canonicalJson).digest('hex');

      const jsonPayload = {
        custodialLedger: 'Crown & Ledger Legal Evidence Management System',
        exportTimestamp,
        exportedBy: {
          id: params.actor.id,
          fullName: params.actor.fullName,
          role: params.actor.role,
        },
        matterScope: params.matterId || 'All Firm Matters',
        recordCount: records.length,
        integrityHashSha256: integrityHash,
        records,
      };

      content = JSON.stringify(jsonPayload, null, 2);

      // Log the export action itself in public.audit_logs (append-only)
      await this.logEvent({
        actorId: params.actor.id,
        actorName: params.actor.fullName,
        actorInitials: params.actor.initials,
        matterId: params.matterId,
        action: 'audit_exported',
        targetName: 'Audit Trail Export (JSON)',
        details: `Exported ${records.length} custodial audit events (JSON) by ${params.actor.fullName}. Integrity SHA-256: ${integrityHash.slice(0, 16)}...`,
        ipAddress: params.ipAddress,
        metadata: {
          format: 'json',
          recordCount: records.length,
          integrityHashSha256: integrityHash,
          exportedAt: exportTimestamp,
        },
      }).catch(console.error);

      return {
        content,
        format: 'json',
        filename,
        recordCount: records.length,
        integrityHash,
        exportedAt: exportTimestamp,
      };
    } else {
      // CSV format
      const escapeCsv = (str: any) => {
        if (str === null || str === undefined) return '""';
        return `"${String(str).replace(/"/g, '""')}"`;
      };

      const rows = records.map((r) => [
        escapeCsv(r.id),
        escapeCsv(r.timestamp),
        escapeCsv(r.actorName),
        escapeCsv(r.actorInitials),
        escapeCsv(r.action),
        escapeCsv(r.matterReference),
        escapeCsv(r.documentId),
        escapeCsv(r.targetName),
        escapeCsv(r.details),
        escapeCsv(r.ipAddress),
      ].join(','));

      const csvBody = [
        'ID,Timestamp,Actor Name,Initials,Action,Matter Reference,Document ID,Target Name,Details,IP Address',
        ...rows,
      ].join('\n');

      const integrityHash = crypto.createHash('sha256').update(csvBody).digest('hex');

      const csvHeaderComments = [
        '# ============================================================================== #',
        '# CROWN & LEDGER LEGAL EVIDENCE WORKSPACE — CUSTODIAL AUDIT TRAIL EXPORT         #',
        `# Export Timestamp: ${exportTimestamp}`,
        `# Exported By: ${params.actor.fullName} (${params.actor.role})`,
        `# Matter Scope: ${params.matterId || 'All Firm Matters'}`,
        `# Record Count: ${records.length}`,
        `# Cryptographic Integrity SHA-256 Digest: ${integrityHash}`,
        '# ============================================================================== #',
      ].join('\n');

      content = `${csvHeaderComments}\n${csvBody}`;

      // Log the export action itself in public.audit_logs (append-only)
      await this.logEvent({
        actorId: params.actor.id,
        actorName: params.actor.fullName,
        actorInitials: params.actor.initials,
        matterId: params.matterId,
        action: 'audit_exported',
        targetName: 'Audit Trail Export (CSV)',
        details: `Exported ${records.length} custodial audit events (CSV) by ${params.actor.fullName}. Integrity SHA-256: ${integrityHash.slice(0, 16)}...`,
        ipAddress: params.ipAddress,
        metadata: {
          format: 'csv',
          recordCount: records.length,
          integrityHashSha256: integrityHash,
          exportedAt: exportTimestamp,
        },
      }).catch(console.error);

      return {
        content,
        format: 'csv',
        filename,
        recordCount: records.length,
        integrityHash,
        exportedAt: exportTimestamp,
      };
    }
  }
}

export const auditService = new AuditService();
