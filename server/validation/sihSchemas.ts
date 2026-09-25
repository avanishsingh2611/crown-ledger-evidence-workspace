import { z } from 'zod';
import { CaseStage, ParticipantRole, CustodyTransferType } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_REGEX = /^[0-9a-f]{64}$/i;

export const uuidSchema = z.string().regex(UUID_REGEX, 'Invalid UUID format');
export const sha256Schema = z.string().regex(SHA256_REGEX, 'Must be a 64-character hexadecimal SHA-256 hash');

export const caseStageEnum = z.enum([
  'Filing',
  'Investigation',
  'Pre-Trial',
  'Trial',
  'Evidence Hearing',
  'Judgement',
  'Appeal',
  'Closed',
] as [CaseStage, ...CaseStage[]]);

export const participantRoleEnum = z.enum([
  'judge',
  'prosecutor',
  'defense_lawyer',
  'victim',
  'forensic_examiner',
  'investigating_officer',
  'auditor',
] as [ParticipantRole, ...ParticipantRole[]]);

export const custodyTransferTypeEnum = z.enum([
  'INTAKE',
  'LAB_ANALYSIS',
  'COURT_SUBMISSION',
  'VAULT_STORAGE',
  'RELEASE',
] as [CustodyTransferType, ...CustodyTransferType[]]);

// ----------------------------------------------------------------------
// Court Cases Schemas
// ----------------------------------------------------------------------

export const createCaseSchema = z.object({
  body: z.object({
    caseNumber: z
      .string()
      .trim()
      .min(3, 'Case number must be at least 3 characters')
      .max(64, 'Case number cannot exceed 64 characters'),
    matterId: uuidSchema,
    courtName: z.string().trim().min(3, 'Court name must be at least 3 characters').max(255),
    jurisdiction: z.string().trim().min(2, 'Jurisdiction must be at least 2 characters').max(255),
    caseType: z.string().trim().min(2, 'Case type must be at least 2 characters').max(64),
    firNumber: z.string().trim().max(64).optional().nullable(),
    policeStation: z.string().trim().max(128).optional().nullable(),
    presidingJudgeId: uuidSchema.optional().nullable(),
    investigationOfficerId: uuidSchema.optional().nullable(),
    stage: caseStageEnum.default('Investigation'),
    filingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Filing date must be in YYYY-MM-DD format').optional().nullable(),
    nextHearingDate: z.string().datetime({ message: 'Next hearing date must be valid ISO-8601' }).optional().nullable(),
  }),
});

export const updateCaseSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    courtName: z.string().trim().min(3).max(255).optional(),
    jurisdiction: z.string().trim().min(2).max(255).optional(),
    caseType: z.string().trim().min(2).max(64).optional(),
    firNumber: z.string().trim().max(64).optional().nullable(),
    policeStation: z.string().trim().max(128).optional().nullable(),
    presidingJudgeId: uuidSchema.optional().nullable(),
    investigationOfficerId: uuidSchema.optional().nullable(),
    stage: caseStageEnum.optional(),
    filingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Filing date must be in YYYY-MM-DD format').optional().nullable(),
    nextHearingDate: z.string().datetime({ message: 'Next hearing date must be valid ISO-8601' }).optional().nullable(),
  }),
});

export const caseIdParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ----------------------------------------------------------------------
// Case Participants Schemas
// ----------------------------------------------------------------------

export const addParticipantSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    userId: uuidSchema,
    participantRole: participantRoleEnum,
    isPrimary: z.boolean().default(false),
  }),
});

export const updateParticipantSchema = z.object({
  params: z.object({
    id: uuidSchema,
    participantId: uuidSchema,
  }),
  body: z.object({
    participantRole: participantRoleEnum.optional(),
    isPrimary: z.boolean().optional(),
  }),
});

export const participantParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
    participantId: uuidSchema,
  }),
});

// ----------------------------------------------------------------------
// Forensic Reports Schemas
// ----------------------------------------------------------------------

export const createForensicReportSchema = z.object({
  params: z.object({
    id: uuidSchema, // court_case_id
  }),
  body: z.object({
    documentId: uuidSchema.optional().nullable(),
    labName: z.string().trim().min(2, 'Lab name must be at least 2 characters').max(128),
    deviceType: z.string().trim().min(2).max(64),
    deviceMakeModel: z.string().trim().min(2).max(128),
    deviceSerialNumber: z.string().trim().min(2).max(128),
    extractionTool: z.string().trim().min(2).max(64),
    extractionToolVersion: z.string().trim().min(1).max(32),
    acquisitionSha256: sha256Schema,
    verificationSha256: sha256Schema,
    hashesMatch: z.boolean(),
    intakeCondition: z.string().trim().min(2),
    findingsSummary: z.string().trim().min(2),
    section65bCertified: z.boolean().default(false),
  }),
});

export const updateForensicReportSchema = z.object({
  params: z.object({
    id: uuidSchema, // report id
  }),
  body: z.object({
    labName: z.string().trim().min(2).max(128).optional(),
    deviceType: z.string().trim().min(2).max(64).optional(),
    deviceMakeModel: z.string().trim().min(2).max(128).optional(),
    deviceSerialNumber: z.string().trim().min(2).max(128).optional(),
    extractionTool: z.string().trim().min(2).max(64).optional(),
    extractionToolVersion: z.string().trim().min(1).max(32).optional(),
    acquisitionSha256: sha256Schema.optional(),
    verificationSha256: sha256Schema.optional(),
    hashesMatch: z.boolean().optional(),
    intakeCondition: z.string().trim().min(2).optional(),
    findingsSummary: z.string().trim().min(2).optional(),
    section65bCertified: z.boolean().optional(),
  }),
});

export const reportIdParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ----------------------------------------------------------------------
// Evidence Chain of Custody Schemas
// ----------------------------------------------------------------------

export const recordCustodyTransferSchema = z.object({
  params: z.object({
    documentId: uuidSchema,
  }),
  body: z.object({
    receivingPartyId: uuidSchema,
    releasingPartyId: uuidSchema.optional(), // Only workspace_admin can override; defaults to req.user.id
    transferType: custodyTransferTypeEnum,
    purpose: z.string().trim().min(3, 'Purpose must be at least 3 characters'),
    securitySealNumber: z.string().trim().min(2, 'Security seal number required').max(64),
    sealIntact: z.boolean().default(true),
    sha256Verified: z.boolean().default(true),
    transferTimestamp: z.string().datetime().optional(),
    notes: z.string().trim().optional().nullable(),
  }),
});

export const documentCustodyParamSchema = z.object({
  params: z.object({
    documentId: uuidSchema,
  }),
});

// ----------------------------------------------------------------------
// Notifications Schemas
// ----------------------------------------------------------------------

export const notificationIdParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});
