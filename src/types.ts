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
export type ReviewWorkflowStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';
export type AuditActionType =
  | 'uploaded'
  | 'review_requested'
  | 'accessed'
  | 'classification_changed'
  | 'review_completed'
  | 'matter_created'
  | 'matter_updated'
  | 'downloaded'
  | 'audit_exported';

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  initials: string;
  role: UserRole;
  title: string;
  avatarUrl?: string;
  isActive: boolean;
}

export interface Matter {
  id: string;
  referenceCode: string;
  title: string;
  clientName: string;
  matterType: string;
  status: MatterStatus;
  riskLevel: RiskLevel;
  leadAttorneyId: string;
  leadAttorneyName: string;
  description: string;
  documentCount: number;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  originalFilename: string;
  fileExtension: string;
  mimeType: string;
  fileSizeBytes: number;
  storagePath: string;
  sha256Checksum: string;
  changeSummary: string;
  uploadedBy: string;
  uploaderName: string;
  createdAt: string;
}

export type RestrictedAccessStatus = 'pending' | 'approved' | 'denied';

export interface RestrictedAccessRequest {
  id: string;
  documentId: string;
  documentTitle: string;
  classification: DocumentClassification;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  matterId: string;
  matterReference: string;
  matterTitle: string;
  reason: string;
  status: RestrictedAccessStatus;
  reviewerId?: string | null;
  reviewerName?: string | null;
  decisionNote?: string | null;
  approvedUntil?: string | null;
  createdAt: string;
  decidedAt?: string | null;
}

export interface EvidenceDocument {
  id: string;
  matterId: string;
  matterReference: string;
  matterTitle: string;
  title: string;
  classification: DocumentClassification;
  reviewStatus: DocumentReviewStatus;
  currentVersionNumber: number;
  tags: string[];
  isArchived: boolean;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
  currentVersion: DocumentVersion;
  allVersions: DocumentVersion[];
  reviewRecord?: ReviewRecord;
  userHasAccess?: boolean;
  accessRequestStatus?: RestrictedAccessStatus | 'none';
  approvedUntil?: string | null;
  isArchivedMatter?: boolean;
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
  decisionNotes?: string;
  completedAt?: string;
  createdAt: string;
}

export interface AuditLogEntry {
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
  metadata: Record<string, any>;
  createdAt: string;
}

export interface DownloadSecurityEvent {
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
  createdAt: string;
}

export interface CourtCase {
  id: string;
  matterId: string;
  caseNumber: string;
  courtName: string;
  jurisdiction: string;
  caseType: string;
  firNumber?: string;
  policeStation?: string;
  presidingJudgeId?: string | null;
  presidingJudgeName?: string;
  investigationOfficerId?: string | null;
  investigationOfficerName?: string;
  stage: CaseStage;
  filingDate?: string;
  nextHearingDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseParticipant {
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

export interface ForensicReport {
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

export interface EvidenceCustodyTransfer {
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

export interface AppNotification {
  id: string;
  recipientId: string;
  courtCaseId?: string | null;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}

