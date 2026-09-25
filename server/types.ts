import { Request } from 'express';

export type UserRole =
  | 'workspace_admin'
  | 'attorney'
  | 'reviewer'
  | 'auditor'
  | 'judge'
  | 'victim'
  | 'forensic_team'
  | 'investigating_officer';

export type CaseStage =
  | 'Filing'
  | 'Investigation'
  | 'Pre-Trial'
  | 'Trial'
  | 'Evidence Hearing'
  | 'Judgement'
  | 'Appeal'
  | 'Closed';

export type ParticipantRole =
  | 'judge'
  | 'prosecutor'
  | 'defense_lawyer'
  | 'victim'
  | 'forensic_examiner'
  | 'investigating_officer'
  | 'auditor';

export type CustodyTransferType =
  | 'INTAKE'
  | 'LAB_ANALYSIS'
  | 'COURT_SUBMISSION'
  | 'VAULT_STORAGE'
  | 'RELEASE';

export type NotificationType =
  | 'hearing_scheduled'
  | 'evidence_submitted'
  | 'clearance_decided'
  | 'custody_transferred'
  | 'case_status_updated';
export type MatterStatus = 'active' | 'archived' | 'closed';
export type RiskLevel = 'high' | 'medium' | 'low';
export type MatterAccessRole = 'lead' | 'contributor' | 'viewer';
export type DocumentClassification = 'privileged' | 'confidential' | 'internal' | 'public' | 'restricted';
export type DocumentReviewStatus = 'needs_review' | 'reviewed' | 'restricted';
export type ReviewWorkflowStatus = 'pending' | 'in_review' | 'completed' | 'rejected';
export type AuditActionType =
  | 'uploaded'
  | 'review_requested'
  | 'accessed'
  | 'classification_changed'
  | 'review_completed'
  | 'matter_created'
  | 'matter_updated'
  | 'downloaded'
  | 'classified'
  | 'version_bumped'
  | 'security_alert'
  | 'access_requested'
  | 'access_approved'
  | 'access_denied'
  | 'audit_exported';

export type RestrictedAccessStatus = 'pending' | 'approved' | 'denied';

export interface RestrictedAccessRequestRecord {
  id: string;
  documentId: string;
  documentTitle?: string;
  requesterId: string;
  requesterName?: string;
  requesterEmail?: string;
  matterId: string;
  matterReference?: string;
  matterTitle?: string;
  classification?: DocumentClassification;
  reason: string;
  status: RestrictedAccessStatus;
  reviewerId?: string | null;
  reviewerName?: string | null;
  decisionNote?: string | null;
  approvedUntil?: string | null;
  createdAt: string;
  decidedAt?: string | null;
}

export interface DocumentFilterParams {
  matterId?: string;
  reviewStatus?: string;
  classification?: string;
  search?: string;
  sha256Hash?: string;
  fileType?: string;
  uploaderId?: string;
  limit?: number;
  offset?: number;
}

export interface AuthUserProfile {
  id: string;
  email: string;
  fullName: string;
  initials: string;
  role: UserRole;
  title: string;
  isActive: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserProfile;
}

export interface MatterRecord {
  id: string;
  referenceCode: string;
  title: string;
  clientName: string;
  matterType: string;
  status: MatterStatus;
  riskLevel: RiskLevel;
  leadAttorneyId: string;
  leadAttorneyName: string;
  fileCount: number;
  unreviewedCount: number;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersionRecord {
  id: string;
  documentId: string;
  versionNumber: number;
  originalFilename: string;
  storagePath: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  mimeType: string;
  sha256Hash: string;
  uploadedBy: string;
  uploadedByName: string;
  changeSummary: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface ReviewRecord {
  id: string;
  documentId: string;
  documentVersionId: string;
  assignedToId: string;
  assignedToName: string;
  requestedById: string;
  requestedByName: string;
  status: ReviewWorkflowStatus;
  decisionNotes: string;
  completedAt: string | null;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  matterId: string;
  matterReference: string;
  matterTitle: string;
  title: string;
  classification: DocumentClassification;
  reviewStatus: DocumentReviewStatus;
  currentVersionNumber: number;
  currentVersion: DocumentVersionRecord;
  versions: DocumentVersionRecord[];
  reviewRecord?: ReviewRecord;
  tags: string[];
  createdBy: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
  userHasAccess?: boolean;
  accessRequestStatus?: RestrictedAccessStatus | 'none';
  isArchivedMatter?: boolean;
}

export interface AuditLogRecord {
  id: string;
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
  createdAt: string;
}

export interface DownloadSecurityEventRecord {
  id: string;
  documentId: string;
  documentTitle: string;
  versionNumber: number;
  userId: string;
  userName: string;
  matterReference: string;
  actionType: string;
  signedUrlExpiresAt: string;
  downloadVerified: boolean;
  ipAddress?: string;
  createdAt: string;
}

export interface WorkspaceStats {
  totalDocuments: number;
  needsReview: number;
  reviewed: number;
  restricted: number;
  matterCounts: {
    referenceCode: string;
    matterTitle: string;
    matterId: string;
    fileCount: number;
    unreviewedCount: number;
  }[];
}

export interface CourtCaseRecord {
  id: string;
  matterId: string;
  caseNumber: string;
  courtName: string;
  jurisdiction: string;
  caseType: string;
  firNumber?: string | null;
  policeStation?: string | null;
  presidingJudgeId?: string | null;
  presidingJudgeName?: string | null;
  investigationOfficerId?: string | null;
  investigationOfficerName?: string | null;
  stage: CaseStage;
  filingDate?: string | null;
  nextHearingDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseParticipantRecord {
  id: string;
  courtCaseId: string;
  matterId: string;
  userId: string;
  userName?: string;
  userRole?: UserRole;
  participantRole: ParticipantRole;
  isPrimary: boolean;
  assignedBy?: string | null;
  assignedAt: string;
}

export interface ForensicReportRecord {
  id: string;
  documentId?: string | null;
  courtCaseId: string;
  matterId: string;
  examinerId: string;
  examinerName?: string;
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
  section65bCertified: boolean;
  isFinalized: boolean;
  createdAt: string;
  finalizedAt?: string | null;
}

export interface EvidenceCustodyTransferRecord {
  id: string;
  documentId: string;
  documentTitle?: string;
  matterId: string;
  courtCaseId?: string | null;
  releasingPartyId: string;
  releasingPartyName?: string;
  receivingPartyId: string;
  receivingPartyName?: string;
  transferType: CustodyTransferType;
  purpose: string;
  securitySealNumber: string;
  sealIntact: boolean;
  sha256Verified: boolean;
  transferTimestamp: string;
  notes?: string | null;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  recipientId: string;
  courtCaseId?: string | null;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}

