/*
 * Crown & Ledger Evidence Workspace
 * Copyright © 2026 Avanish Singh
 * Author: Avanish Singh
 */

import {
  Profile,
  Matter,
  EvidenceDocument,
  DocumentVersion,
  AuditLogEntry,
  DownloadSecurityEvent,
  DocumentReviewStatus,
  DocumentClassification,
  RestrictedAccessRequest,
  CourtCase,
  CaseParticipant,
  ForensicReport,
  EvidenceCustodyTransfer,
  AppNotification,
  CaseStage,
  ParticipantRole,
  CustodyTransferType,
} from '../types';
import {
  signInToSupabase,
  signOutFromSupabase,
  getSupabaseAccessToken,
  clearSupabaseSession,
  normalizeAuthEmail,
} from './supabase';

export interface ApiErrorResponse {
  error: string;
  message?: string;
  statusCode: number;
}

export class ApiError extends Error {
  statusCode: number;
  errorType: string;

  constructor(statusCode: number, errorType: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorType = errorType;
  }
}

export interface CreateCaseInput {
  caseNumber: string;
  matterId: string;
  courtName: string;
  jurisdiction: string;
  caseType: string;
  firNumber?: string | null;
  policeStation?: string | null;
  presidingJudgeId?: string | null;
  investigationOfficerId?: string | null;
  stage?: CaseStage;
  filingDate?: string | null;
  nextHearingDate?: string | null;
}

export interface UpdateCaseInput {
  courtName?: string;
  jurisdiction?: string;
  caseType?: string;
  firNumber?: string | null;
  policeStation?: string | null;
  presidingJudgeId?: string | null;
  investigationOfficerId?: string | null;
  stage?: CaseStage;
  filingDate?: string | null;
  nextHearingDate?: string | null;
}

export interface AddCaseParticipantInput {
  userId: string;
  participantRole: ParticipantRole;
  isPrimary?: boolean;
}

export interface UpdateCaseParticipantInput {
  participantRole?: ParticipantRole;
  isPrimary?: boolean;
}

export interface CreateForensicReportInput {
  documentId?: string | null;
  labName: string;
  deviceType: string;
  deviceMakeModel: string;
  deviceSerialNumber: string;
  extractionTool: string;
  extractionToolVersion: string;
  acquisitionSha256: string;
  verificationSha256: string;
  hashesMatch: boolean;
  intakeCondition: string;
  findingsSummary: string;
  section65bCertified?: boolean;
}

export interface UpdateForensicReportInput {
  labName?: string;
  deviceType?: string;
  deviceMakeModel?: string;
  deviceSerialNumber?: string;
  extractionTool?: string;
  extractionToolVersion?: string;
  acquisitionSha256?: string;
  verificationSha256?: string;
  hashesMatch?: boolean;
  intakeCondition?: string;
  findingsSummary?: string;
  section65bCertified?: boolean;
}

export interface RecordCustodyTransferInput {
  receivingPartyId: string;
  releasingPartyId?: string;
  transferType: CustodyTransferType;
  purpose: string;
  securitySealNumber: string;
  sealIntact?: boolean;
  sha256Verified?: boolean;
  transferTimestamp?: string;
  notes?: string | null;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

/**
 * Centralized HTTP request utility.
 * Injects Supabase access token via Authorization: Bearer <token>.
 * Rejects unauthenticated requests with HTTP 401.
 * Enforces a default request timeout to prevent the UI from hanging indefinitely.
 * NEVER sends client identity spoofing headers like X-User-Id.
 */
async function request<T>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const token = await getSupabaseAccessToken();
  if (!token) {
    throw new ApiError(401, 'Unauthorized', 'No active authenticated session. Please sign in.');
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> || {}),
  };

  // Strip any accidental X-User-Id header to enforce security compliance
  delete headers['X-User-Id'];
  delete headers['x-user-id'];

  const timeoutMs = options.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        try {
          await clearSupabaseSession();
        } catch {
          // ignore
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('crownledger:session-expired'));
        }
      }

      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }

      const message = errorData.message || errorData.error || `HTTP error ${response.status}`;
      const errorType = errorData.error || response.statusText;

      throw new ApiError(response.status, errorType, message);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new ApiError(
        408,
        'RequestTimeout',
        `Network request to ${endpoint} timed out after ${Math.round(timeoutMs / 1000)}s.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Adapters to ensure robust compatibility with existing frontend models
// ---------------------------------------------------------------------------

function adaptDocumentVersion(v: any): DocumentVersion {
  const filename = v.originalFilename || v.filename || 'document.pdf';
  const ext = filename.split('.').pop() || 'pdf';

  return {
    id: v.id,
    documentId: v.documentId,
    versionNumber: v.versionNumber ?? 1,
    originalFilename: filename,
    fileExtension: ext,
    mimeType: v.mimeType || 'application/pdf',
    fileSizeBytes: v.fileSizeBytes || 0,
    storagePath: v.storagePath || '',
    sha256Checksum: v.sha256Hash || v.sha256Checksum || '',
    changeSummary: v.changeSummary || '',
    uploadedBy: v.uploadedBy || '',
    uploaderName: v.uploadedByName || v.uploaderName || 'Authorized User',
    createdAt: v.createdAt || new Date().toISOString(),
  };
}

export function adaptDocument(doc: any): EvidenceDocument {
  const currentVer = doc.currentVersion ? adaptDocumentVersion(doc.currentVersion) : {
    id: `v-${doc.id}-1`,
    documentId: doc.id,
    versionNumber: doc.currentVersionNumber || 1,
    originalFilename: `${doc.title}.pdf`,
    fileExtension: 'pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 204800,
    storagePath: '',
    sha256Checksum: '',
    changeSummary: 'Initial version',
    uploadedBy: doc.createdBy || '',
    uploaderName: doc.creatorName || 'Authorized User',
    createdAt: doc.createdAt || new Date().toISOString(),
  };

  const rawVersions = doc.versions || doc.allVersions || [doc.currentVersion || currentVer];
  const allVersions = rawVersions.map(adaptDocumentVersion);

  return {
    id: doc.id,
    matterId: doc.matterId,
    matterReference: doc.matterReference || 'MAT-GEN',
    matterTitle: doc.matterTitle || 'General Legal Matter',
    title: doc.title,
    classification: doc.classification as DocumentClassification,
    reviewStatus: doc.reviewStatus as DocumentReviewStatus,
    currentVersionNumber: doc.currentVersionNumber || currentVer.versionNumber,
    tags: doc.tags || [],
    isArchived: doc.isArchived ?? false,
    createdBy: doc.createdBy,
    creatorName: doc.creatorName,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    currentVersion: currentVer,
    allVersions,
    reviewRecord: doc.reviewRecord
      ? {
          id: doc.reviewRecord.id,
          documentId: doc.reviewRecord.documentId,
          documentVersionId: doc.reviewRecord.documentVersionId,
          assignedToId: doc.reviewRecord.assignedToId,
          assignedToName: doc.reviewRecord.assignedToName,
          requestedById: doc.reviewRecord.requestedById,
          requestedByName: doc.reviewRecord.requestedByName,
          status: doc.reviewRecord.status === 'in_review' ? 'in_progress' : doc.reviewRecord.status,
          decisionNotes: doc.reviewRecord.decisionNotes,
          completedAt: doc.reviewRecord.completedAt,
          createdAt: doc.reviewRecord.createdAt,
        }
      : undefined,
    userHasAccess: doc.userHasAccess !== undefined ? doc.userHasAccess : true,
    accessRequestStatus: doc.accessRequestStatus || 'none',
    isArchivedMatter: doc.isArchivedMatter ?? false,
  };
}

export function adaptMatter(m: any): Matter {
  return {
    id: m.id,
    referenceCode: m.referenceCode,
    title: m.title,
    clientName: m.clientName || 'Crown & Ledger Client',
    matterType: m.matterType || 'Litigation',
    status: m.status || 'active',
    riskLevel: m.riskLevel || 'medium',
    leadAttorneyId: m.leadAttorneyId,
    leadAttorneyName: m.leadAttorneyName,
    description: m.description || `Matter reference ${m.referenceCode}`,
    documentCount: m.fileCount ?? m.documentCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Centralized API Service Object
// ---------------------------------------------------------------------------

export const api = {
  /**
   * Fetches current authenticated user and all available profiles.
   */
  async getCurrentUser(): Promise<{ user: Profile; availableProfiles: Profile[] }> {
    const res = await request<{ user: any; availableProfiles: any[] }>('/api/auth/me');
    return {
      user: {
        id: res.user.id,
        email: res.user.email,
        fullName: res.user.fullName,
        initials: res.user.initials,
        role: res.user.role,
        title: res.user.title,
        isActive: res.user.isActive,
      },
      availableProfiles: res.availableProfiles.map((p) => ({
        id: p.id,
        email: p.email,
        fullName: p.fullName,
        initials: p.initials,
        role: p.role,
        title: p.title,
        isActive: p.isActive,
      })),
    };
  },

  /**
   * Authenticates with Supabase Auth using explicit user credentials.
   * Supabase Auth issues a verified JWT token which is then verified by the backend.
   */
  async signIn(email: string, password: string): Promise<{ user: Profile; availableProfiles: Profile[] }> {
    const authEmail = normalizeAuthEmail(email);
    const { session, error } = await signInToSupabase(authEmail, password);
    if (error || !session) {
      throw new ApiError(401, 'AuthenticationFailed', error || 'Invalid email or password');
    }

    // Load verified profile from the backend
    return await this.getCurrentUser();
  },

  /**
   * Signs out of the current session and purges local credentials.
   */
  async signOut(): Promise<void> {
    await signOutFromSupabase();
  },

  /**
   * Fetches matters from the backend database.
   */
  async getMatters(): Promise<Matter[]> {
    const res = await request<{ data: any[]; total: number }>('/api/matters');
    return (res.data || []).map(adaptMatter);
  },

  /**
   * Fetches a single matter by ID or reference code.
   */
  async getMatter(matterId: string): Promise<Matter> {
    const res = await request<{ data: any }>(`/api/matters/${matterId}`);
    return adaptMatter(res.data);
  },

  /**
   * Fetches documents with optional filtering.
   */
  async getDocuments(params?: {
    matterId?: string;
    reviewStatus?: DocumentReviewStatus | 'all';
    classification?: DocumentClassification | 'all';
    search?: string;
    sha256Hash?: string;
    fileType?: string;
    uploaderId?: string;
  }): Promise<EvidenceDocument[]> {
    const query = new URLSearchParams();
    if (params?.matterId && params.matterId !== 'all') {
      query.set('matterId', params.matterId);
    }
    if (params?.reviewStatus && params.reviewStatus !== 'all') {
      query.set('reviewStatus', params.reviewStatus);
    }
    if (params?.classification && params.classification !== 'all') {
      query.set('classification', params.classification);
    }
    if (params?.search && params.search.trim()) {
      query.set('search', params.search.trim());
    }
    if (params?.sha256Hash && params.sha256Hash.trim()) {
      query.set('sha256Hash', params.sha256Hash.trim());
    }
    if (params?.fileType && params.fileType !== 'all') {
      query.set('fileType', params.fileType);
    }
    if (params?.uploaderId && params.uploaderId !== 'all') {
      query.set('uploaderId', params.uploaderId);
    }

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await request<{ data: any[]; total: number }>(`/api/documents${qs}`);
    return (res.data || []).map(adaptDocument);
  },

  /**
   * Search documents.
   */
  async searchDocuments(query: string, filters?: {
    matterId?: string;
    classification?: string;
    reviewStatus?: string;
    sha256Hash?: string;
    fileType?: string;
    uploaderId?: string;
  }): Promise<EvidenceDocument[]> {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (filters?.matterId && filters.matterId !== 'all') params.set('matterId', filters.matterId);
    if (filters?.classification && filters.classification !== 'all') params.set('classification', filters.classification);
    if (filters?.reviewStatus && filters.reviewStatus !== 'all') params.set('reviewStatus', filters.reviewStatus);
    if (filters?.sha256Hash && filters.sha256Hash.trim()) params.set('sha256Hash', filters.sha256Hash.trim());
    if (filters?.fileType && filters.fileType !== 'all') params.set('fileType', filters.fileType);
    if (filters?.uploaderId && filters.uploaderId !== 'all') params.set('uploaderId', filters.uploaderId);

    const res = await request<{ data: any[]; total: number }>(`/api/documents/search?${params.toString()}`);
    return (res.data || []).map(adaptDocument);
  },

  /**
   * Fetches a specific document by ID.
   */
  async getDocument(documentId: string): Promise<EvidenceDocument> {
    const res = await request<{ data: any }>(`/api/documents/${documentId}`);
    return adaptDocument(res.data);
  },

  /**
   * Fetches all versions for a document.
   */
  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    const res = await request<{ data: any[]; total: number }>(`/api/documents/${documentId}/versions`);
    return (res.data || []).map(adaptDocumentVersion);
  },

  /**
   * Fetches document review records from backend.
   */
  async getReviews(params?: { documentId?: string; status?: string }): Promise<any[]> {
    const qs = new URLSearchParams();
    if (params?.documentId) qs.set('documentId', params.documentId);
    if (params?.status) qs.set('status', params.status);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    const res = await request<{ data: any[]; total: number }>(`/api/reviews${query}`);
    return res.data || [];
  },

  /**
   * Certifies/completes review for a document.
   */
  async certifyReview(
    documentId: string,
    decisionNotes: string,
    status: 'reviewed' | 'needs_review' | 'restricted' = 'reviewed'
  ): Promise<{ success: boolean; message: string; reviewRecord: any }> {
    const res = await request<{ success: boolean; message: string; data: any }>(
      `/api/documents/${documentId}/reviews`,
      {
        method: 'POST',
        body: JSON.stringify({
          status,
          decisionNotes,
        }),
      }
    );
    return {
      success: res.success,
      message: res.message,
      reviewRecord: res.data,
    };
  },

  /**
   * Issues a signed download URL from private Supabase Storage.
   * Records a security download event and audit event on the backend.
   */
  async generateSignedDownloadUrl(
    documentId: string,
    versionNumber?: number,
    expiresInSeconds = 300,
    password?: string
  ): Promise<{
    documentId: string;
    title: string;
    versionNumber: number;
    filename: string;
    fileSizeFormatted: string;
    sha256Hash: string;
    signedUrl: string;
    expiresAt: string;
    ttlSeconds: number;
    securityEventId: string;
  }> {
    const res = await request<any>(`/api/documents/${documentId}/signed-url`, {
      method: 'POST',
      body: JSON.stringify({
        versionNumber,
        expiresInSeconds,
        ...(password ? { password } : {}),
      }),
    });
    return res;
  },

  /**
   * Fetches immutable audit logs.
   */
  async getAuditLogs(params?: {
    matterId?: string;
    documentId?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogEntry[]> {
    const qs = new URLSearchParams();
    if (params?.matterId) qs.set('matterId', params.matterId);
    if (params?.documentId) qs.set('documentId', params.documentId);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));

    const query = qs.toString() ? `?${qs.toString()}` : '';
    const res = await request<{ data: any[]; total: number }>(`/api/audit-logs${query}`);
    return (res.data || []).map((log) => ({
      id: log.id,
      actorId: log.actorId,
      actorName: log.actorName,
      actorInitials: log.actorInitials,
      matterId: log.matterId,
      matterReference: log.matterReference,
      documentId: log.documentId,
      action: log.action,
      targetName: log.targetName,
      details: log.details,
      metadata: log.metadata || {},
      createdAt: log.createdAt,
    }));
  },

  /**
   * Fetches download security events.
   */
  async getDownloadSecurityEvents(): Promise<DownloadSecurityEvent[]> {
    const res = await request<{ data: any[]; total: number }>('/api/audit-logs/security-events');
    return (res.data || []).map((evt) => ({
      id: evt.id,
      documentId: evt.documentId,
      documentTitle: evt.documentTitle,
      versionNumber: evt.versionNumber,
      userId: evt.userId,
      userName: evt.userName,
      matterReference: evt.matterReference,
      actionType: evt.actionType || 'signed_url_issued',
      signedUrlExpiresAt: evt.signedUrlExpiresAt,
      downloadVerified: evt.downloadVerified ?? true,
      createdAt: evt.createdAt,
    }));
  },

  /**
   * Fetches computed workspace statistics from the database.
   */
  async getStats(): Promise<{
    totalDocuments: number;
    needsReview: number;
    reviewed: number;
    restricted: number;
    matterCounts: Array<{
      referenceCode: string;
      matterTitle: string;
      matterId: string;
      fileCount: number;
      unreviewedCount: number;
    }>;
  }> {
    const res = await request<{ data: any }>('/api/stats');
    return res.data;
  },

  /**
   * Upload an evidence file to Supabase Storage & register in database
   */
  async uploadEvidenceDocument(formData: FormData): Promise<EvidenceDocument> {
    const res = await request<{ data: any }>('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
    return adaptDocument(res.data);
  },

  /**
   * Upload a new version for an existing document
   */
  async uploadDocumentVersion(
    documentId: string,
    formData: FormData
  ): Promise<{ document: EvidenceDocument; version: DocumentVersion }> {
    const res = await request<{ data: { document: any; version: any } }>(
      `/api/documents/${documentId}/upload-version`,
      {
        method: 'POST',
        body: formData,
      }
    );
    return {
      document: adaptDocument(res.data.document),
      version: adaptDocumentVersion(res.data.version),
    };
  },

  /**
   * List available sample cases from the local demonstration directory
   */
  async getSampleCases(): Promise<Array<{
    filename: string;
    sizeBytes: number;
    sizeFormatted: string;
    suggestedTitle: string;
  }>> {
    const res = await request<{ data: any[] }>('/api/documents/sample-cases');
    return res.data || [];
  },

  /**
   * Import a sample case file directly into a matter
   */
  async importSampleCase(params: {
    sampleFilename: string;
    matterId: string;
    title?: string;
    classification?: string;
  }): Promise<EvidenceDocument> {
    const res = await request<{ data: any }>('/api/documents/import-sample', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return adaptDocument(res.data);
  },

  /**
   * Submit an access request for a restricted or confidential document
   */
  async requestRestrictedAccess(
    documentId: string,
    reason: string
  ): Promise<RestrictedAccessRequest> {
    const res = await request<{ data: RestrictedAccessRequest }>(
      '/api/restricted-access/requests',
      {
        method: 'POST',
        body: JSON.stringify({ documentId, reason }),
      }
    );
    return res.data;
  },

  /**
   * List pending or filtered restricted access requests
   */
  async getRestrictedAccessRequests(filters?: {
    status?: string;
    matterId?: string;
  }): Promise<RestrictedAccessRequest[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.matterId) params.append('matterId', filters.matterId);
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const res = await request<{ data: RestrictedAccessRequest[] }>(
      `/api/restricted-access/requests${queryString}`
    );
    return res.data || [];
  },

  /**
   * Approve or deny a restricted access request
   */
  async decideRestrictedAccessRequest(
    requestId: string,
    decision: 'approved' | 'denied',
    decisionNote: string,
    approvedUntil?: string
  ): Promise<RestrictedAccessRequest> {
    const res = await request<{ data: RestrictedAccessRequest }>(
      `/api/restricted-access/requests/${requestId}/decision`,
      {
        method: 'POST',
        body: JSON.stringify({ decision, decisionNote, approvedUntil }),
      }
    );
    return res.data;
  },

  /**
   * Export custodial audit logs as CSV or JSON with cryptographic integrity verification
   */
  async exportAuditLogs(
    format: 'csv' | 'json' = 'csv',
    matterId?: string
  ): Promise<{ blob: Blob; filename: string; integrityHash: string }> {
    const token = await getSupabaseAccessToken();
    if (!token) {
      throw new ApiError(401, 'Unauthorized', 'No active authenticated session.');
    }

    const params = new URLSearchParams();
    params.set('format', format);
    if (matterId && matterId !== 'all') {
      params.set('matterId', matterId);
    }

    const res = await fetch(`/api/audit-logs/export?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        await clearSupabaseSession();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('crownledger:session-expired'));
        }
      }
      let errJson: any = {};
      try {
        errJson = await res.json();
      } catch {}
      throw new ApiError(res.status, errJson.error || res.statusText, errJson.message || 'Audit export failed');
    }

    const integrityHash = res.headers.get('X-Audit-Integrity-SHA256') || '';
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `crown-ledger-audit-export.${format}`;
    const blob = await res.blob();

    return { blob, filename, integrityHash };
  },

  // ---------------------------------------------------------------------------
  // Court Cases API (SIH)
  // ---------------------------------------------------------------------------

  /**
   * List authorized court cases for the current authenticated user
   */
  async getCases(): Promise<CourtCase[]> {
    const res = await request<{ data: CourtCase[]; total: number }>('/api/cases');
    return res.data || [];
  },

  /**
   * Get court case details by case ID
   */
  async getCase(id: string): Promise<CourtCase> {
    const res = await request<{ data: CourtCase }>(`/api/cases/${id}`);
    return res.data;
  },

  /**
   * Create a new court case linked to a legal matter
   */
  async createCase(data: CreateCaseInput): Promise<CourtCase> {
    const res = await request<{ data: CourtCase }>('/api/cases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  /**
   * Update court case details (e.g. stage, next hearing date, etc.)
   */
  async updateCase(id: string, data: UpdateCaseInput): Promise<CourtCase> {
    const res = await request<{ data: CourtCase }>(`/api/cases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  // ---------------------------------------------------------------------------
  // Case Participants API (SIH)
  // ---------------------------------------------------------------------------

  /**
   * List participants for a specific court case
   */
  async getCaseParticipants(caseId: string): Promise<CaseParticipant[]> {
    const res = await request<{ data: CaseParticipant[]; total: number }>(
      `/api/cases/${caseId}/participants`
    );
    return res.data || [];
  },

  /**
   * Add an authorized participant to a court case
   */
  async addCaseParticipant(
    caseId: string,
    data: AddCaseParticipantInput
  ): Promise<CaseParticipant> {
    const res = await request<{ data: CaseParticipant }>(
      `/api/cases/${caseId}/participants`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  /**
   * Update participant role or primary status
   */
  async updateCaseParticipant(
    caseId: string,
    participantId: string,
    data: UpdateCaseParticipantInput
  ): Promise<CaseParticipant> {
    const res = await request<{ data: CaseParticipant }>(
      `/api/cases/${caseId}/participants/${participantId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  /**
   * Remove a participant from a court case
   */
  async removeCaseParticipant(caseId: string, participantId: string): Promise<void> {
    await request<void>(`/api/cases/${caseId}/participants/${participantId}`, {
      method: 'DELETE',
    });
  },

  // ---------------------------------------------------------------------------
  // Digital Forensic Reports API (SIH)
  // ---------------------------------------------------------------------------

  /**
   * List forensic reports for a court case
   */
  async getForensicReports(caseId: string): Promise<ForensicReport[]> {
    const res = await request<{ data: ForensicReport[]; total: number }>(
      `/api/cases/${caseId}/forensic-reports`
    );
    return res.data || [];
  },

  /**
   * Get a single forensic report by ID
   */
  async getForensicReport(reportId: string): Promise<ForensicReport> {
    const res = await request<{ data: ForensicReport }>(`/api/forensic-reports/${reportId}`);
    return res.data;
  },

  /**
   * Create a draft forensic report for a court case
   */
  async createForensicReport(
    caseId: string,
    data: CreateForensicReportInput
  ): Promise<ForensicReport> {
    const res = await request<{ data: ForensicReport }>(
      `/api/cases/${caseId}/forensic-reports`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  /**
   * Update draft forensic report details
   */
  async updateForensicReport(
    reportId: string,
    data: UpdateForensicReportInput
  ): Promise<ForensicReport> {
    const res = await request<{ data: ForensicReport }>(`/api/forensic-reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  /**
   * Finalize forensic report under Section 65B verification (freezes report)
   */
  async finalizeForensicReport(reportId: string): Promise<ForensicReport> {
    const res = await request<{ data: ForensicReport }>(
      `/api/forensic-reports/${reportId}/finalize`,
      {
        method: 'POST',
      }
    );
    return res.data;
  },

  // ---------------------------------------------------------------------------
  // Evidence Chain of Custody API (SIH)
  // ---------------------------------------------------------------------------

  /**
   * View append-only custody ledger history for an evidence document
   */
  async getDocumentCustody(documentId: string): Promise<EvidenceCustodyTransfer[]> {
    const res = await request<{ data: EvidenceCustodyTransfer[]; total: number }>(
      `/api/documents/${documentId}/custody`
    );
    return res.data || [];
  },

  /**
   * Record an immutable custody transfer for an evidence document
   */
  async recordCustodyTransfer(
    documentId: string,
    data: RecordCustodyTransferInput
  ): Promise<EvidenceCustodyTransfer> {
    const res = await request<{ data: EvidenceCustodyTransfer }>(
      `/api/documents/${documentId}/custody`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  // ---------------------------------------------------------------------------
  // Notifications API (SIH)
  // ---------------------------------------------------------------------------

  /**
   * List notifications for the authenticated user
   */
  async getNotifications(params?: {
    unread?: boolean;
    limit?: number;
  }): Promise<{ notifications: AppNotification[]; total: number; unreadCount: number }> {
    const qs = new URLSearchParams();
    if (params?.unread !== undefined) qs.set('unread', String(params.unread));
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';

    const res = await request<{ data: AppNotification[]; total: number; unreadCount: number }>(
      `/api/notifications${query}`
    );
    return {
      notifications: res.data || [],
      total: res.total ?? (res.data ? res.data.length : 0),
      unreadCount: res.unreadCount ?? (res.data ? res.data.filter((n) => !n.isRead).length : 0),
    };
  },

  /**
   * Mark a notification as read
   */
  async markNotificationAsRead(id: string): Promise<AppNotification> {
    const res = await request<{ data: AppNotification }>(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    });
    return res.data;
  },
};

