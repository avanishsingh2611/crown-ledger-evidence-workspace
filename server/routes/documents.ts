import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { AuthenticatedRequest } from '../types';
import { documentService } from '../services/documentService';
import { versionService } from '../services/versionService';
import { reviewService } from '../services/reviewService';
import { storageService } from '../services/storageService';
import { auditService } from '../services/auditService';
import { matterService } from '../services/matterService';
import { restrictedAccessService } from '../services/restrictedAccessService';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/rbac';
import { supabaseAdmin } from '../supabase';
import { config } from '../config';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 104857600, // 100 MB maximum size limit
  },
});

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'image/tiff',
  'image/png',
  'image/jpeg',
]);

const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'docx',
  'xlsx',
  'csv',
  'txt',
  'tiff',
  'tif',
  'png',
  'jpeg',
  'jpg',
]);

function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function validateBufferSignature(buffer: Buffer, ext: string): { valid: boolean; reason?: string } {
  if (ext === 'pdf') {
    if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return { valid: true };
    }
    return { valid: false, reason: 'Invalid PDF: File does not start with %PDF header' };
  }
  if (ext === 'png') {
    if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return { valid: true };
    }
    return { valid: false, reason: 'Invalid PNG: Corrupted or mismatched PNG signature' };
  }
  if (ext === 'jpg' || ext === 'jpeg') {
    if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return { valid: true };
    }
    return { valid: false, reason: 'Invalid JPEG: Corrupted or mismatched JPEG signature' };
  }
  if (ext === 'tiff' || ext === 'tif') {
    if (
      buffer.length >= 4 &&
      ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) ||
        (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A))
    ) {
      return { valid: true };
    }
    return { valid: false, reason: 'Invalid TIFF: Corrupted or mismatched TIFF header' };
  }
  if (ext === 'docx' || ext === 'xlsx') {
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4B &&
      (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
    ) {
      return { valid: true };
    }
    return { valid: false, reason: `Invalid ${ext.toUpperCase()}: Missing standard OpenXML/ZIP container signature` };
  }
  if (ext === 'txt' || ext === 'csv') {
    if (buffer.length >= 2 && buffer[0] === 0x4D && buffer[1] === 0x5A) {
      return { valid: false, reason: 'Security alert: Disguised binary executable (MZ/PE) detected.' };
    }
    const checkLen = Math.min(buffer.length, 512);
    for (let i = 0; i < checkLen; i++) {
      if (buffer[i] === 0x00) {
        return { valid: false, reason: `Invalid ${ext.toUpperCase()}: Binary null bytes detected in text file` };
      }
    }
    return { valid: true };
  }
  return { valid: true };
}

const listDocumentsQuerySchema = z.object({
  query: z.object({
    matterId: z.string().optional(),
    reviewStatus: z.enum(['needs_review', 'reviewed', 'restricted', 'all']).optional(),
    classification: z.enum(['privileged', 'confidential', 'internal', 'public', 'restricted', 'all']).optional(),
    search: z.string().optional(),
    sha256Hash: z.string().optional(),
    fileType: z.string().optional(),
    uploaderId: z.string().optional(),
    limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : undefined)),
    offset: z.string().optional().transform((v) => (v ? parseInt(v, 10) : undefined)),
  }),
});

const searchDocumentsQuerySchema = z.object({
  query: z.object({
    q: z.string().optional(),
    search: z.string().optional(),
    matterId: z.string().optional(),
    classification: z.enum(['privileged', 'confidential', 'internal', 'public', 'all']).optional(),
    reviewStatus: z.enum(['needs_review', 'reviewed', 'restricted', 'all']).optional(),
    sha256Hash: z.string().optional(),
    hash: z.string().optional(),
    fileType: z.string().optional(),
    uploaderId: z.string().optional(),
    limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : undefined)),
    offset: z.string().optional().transform((v) => (v ? parseInt(v, 10) : undefined)),
  }),
});

const documentIdParamSchema = z.object({
  params: z.object({
    documentId: z.string().min(1),
  }),
});

const versionParamSchema = z.object({
  params: z.object({
    documentId: z.string().min(1),
    versionId: z.string().min(1),
  }),
});

const reviewBodySchema = z.object({
  params: z.object({
    documentId: z.string().min(1),
  }),
  body: z.object({
    status: z.enum(['needs_review', 'reviewed', 'restricted']),
    decisionNotes: z.string().min(3, 'Decision notes are required for legal audit trail'),
  }),
});

const createDocumentBodySchema = z.object({
  body: z.object({
    matterId: z.string().min(1),
    matterReference: z.string().min(1),
    matterTitle: z.string().min(1),
    title: z.string().min(3),
    classification: z.enum(['privileged', 'confidential', 'internal', 'public']),
    reviewStatus: z.enum(['needs_review', 'reviewed', 'restricted']).optional(),
    tags: z.array(z.string()).optional(),
    filename: z.string().min(1),
    storagePath: z.string().optional(),
    fileSizeBytes: z.number().positive(),
    mimeType: z.string().default('application/pdf'),
    sha256Hash: z.string().min(8),
    changeSummary: z.string().default('Initial upload'),
  }),
});

const addVersionBodySchema = z.object({
  params: z.object({
    documentId: z.string().min(1),
  }),
  body: z.object({
    filename: z.string().min(1),
    storagePath: z.string().optional(),
    fileSizeBytes: z.number().positive(),
    mimeType: z.string().default('application/pdf'),
    sha256Hash: z.string().min(8),
    changeSummary: z.string().min(3, 'Change summary is required'),
  }),
});

// GET /api/documents
router.get('/', validate(listDocumentsQuerySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { matterId, reviewStatus, classification, search, sha256Hash, fileType, uploaderId, limit, offset } =
      req.query as any;
    const documents = await documentService.getAllDocuments(
      {
        matterId,
        reviewStatus,
        classification,
        search,
        sha256Hash,
        fileType,
        uploaderId,
        limit,
        offset,
      },
      req.user
    );

    const user = req.user;
    const enriched = await Promise.all(
      documents.map(async (doc) => {
        const isArchivedMatter = await matterService.isMatterArchived(doc.matterId);
        if (!user) return { ...doc, isArchivedMatter, userHasAccess: true, accessRequestStatus: 'none' as const };
        const clearance = await restrictedAccessService.checkUserDocumentAccess(user, doc);
        return {
          ...doc,
          userHasAccess: clearance.hasAccess,
          accessRequestStatus: clearance.accessRequestStatus,
          approvedUntil: clearance.approvedUntil || null,
          isArchivedMatter,
        };
      })
    );

    // If an explicit search term or hash was passed, apply the Search Clearance Shield:
    // Unauthorized users must NOT discover the existence or metadata of restricted evidence
    const isSearchQuery = Boolean((search && search.trim().length > 0) || (sha256Hash && sha256Hash.trim().length > 0));
    const finalData = isSearchQuery ? enriched.filter((doc) => doc.userHasAccess) : enriched;

    res.json({
      data: finalData,
      total: finalData.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve documents', message: error.message });
  }
});

// GET /api/documents/search
router.get('/search', validate(searchDocumentsQuerySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = req.query as any;
    const searchTerm = query.q || query.search || '';
    const sha256Hash = query.sha256Hash || query.hash || '';
    const classification = query.classification;
    const reviewStatus = query.reviewStatus;
    const matterId = query.matterId;
    const fileType = query.fileType;
    const uploaderId = query.uploaderId;
    const limit = query.limit;
    const offset = query.offset;

    const documents = await documentService.getAllDocuments(
      {
        search: searchTerm,
        sha256Hash,
        classification,
        reviewStatus,
        matterId,
        fileType,
        uploaderId,
        limit,
        offset,
      },
      req.user
    );

    const user = req.user;
    const enriched = await Promise.all(
      documents.map(async (doc) => {
        const isArchivedMatter = await matterService.isMatterArchived(doc.matterId);
        if (!user) return { ...doc, isArchivedMatter, userHasAccess: true, accessRequestStatus: 'none' as const };
        const clearance = await restrictedAccessService.checkUserDocumentAccess(user, doc);
        return {
          ...doc,
          userHasAccess: clearance.hasAccess,
          accessRequestStatus: clearance.accessRequestStatus,
          approvedUntil: clearance.approvedUntil || null,
          isArchivedMatter,
        };
      })
    );

    // Enforce Search Clearance Shield (TASK 1):
    // Unauthorized users must NEVER discover restricted evidence through search
    const authorizedResults = enriched.filter((doc) => doc.userHasAccess);

    res.json({
      data: authorizedResults,
      total: authorizedResults.length,
      query: searchTerm,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to search documents', message: error.message });
  }
});

// GET /api/documents/sample-cases
router.get('/sample-cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectSampleDir = path.resolve(process.cwd(), 'sample-data/cases');
    const fallbackDir = path.resolve('c:/Users/sa485/Downloads/Sample Cases');
    const sampleDir =
      fs.existsSync(projectSampleDir) && fs.readdirSync(projectSampleDir).length > 0
        ? projectSampleDir
        : fallbackDir;

    if (!fs.existsSync(sampleDir)) {
      res.json({ data: [], total: 0 });
      return;
    }

    const files = fs.readdirSync(sampleDir);
    const pdfFiles = files
      .filter((f) => f.toLowerCase().endsWith('.pdf'))
      .map((filename) => {
        const filePath = path.join(sampleDir, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          sizeBytes: stats.size,
          sizeFormatted: stats.size >= 1048576 ? `${(stats.size / 1048576).toFixed(1)} MB` : `${Math.round(stats.size / 1024)} KB`,
          suggestedTitle: filename,
        };
      });

    res.json({ data: pdfFiles, total: pdfFiles.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list sample cases', message: err.message });
  }
});

// GET /api/documents/:documentId
router.get('/:documentId', validate(documentIdParamSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doc = await documentService.getDocumentById(req.params.documentId);
    if (!doc) {
      res.status(404).json({ error: 'Not Found', message: `Document ${req.params.documentId} not found` });
      return;
    }

    // Security check: Matter access clearance
    if (req.user && req.user.role !== 'workspace_admin' && req.user.role !== 'auditor') {
      const hasAccess = await matterService.checkUserMatterAccess(req.user.id, doc.matterId);
      if (!hasAccess) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied: You are not assigned to the matter associated with this document.',
        });
        return;
      }
    }

    const isArchivedMatter = await matterService.isMatterArchived(doc.matterId);
    let userHasAccess = true;
    let accessRequestStatus: any = 'none';
    let approvedUntil: string | null = null;

    if (req.user) {
      const clearance = await restrictedAccessService.checkUserDocumentAccess(req.user, doc);
      userHasAccess = clearance.hasAccess;
      accessRequestStatus = clearance.accessRequestStatus;
      approvedUntil = clearance.approvedUntil || null;
    }

    // Append access log in background
    if (req.user) {
      auditService.logEvent({
        actorId: req.user.id,
        actorName: req.user.fullName,
        actorInitials: req.user.initials,
        matterId: doc.matterId,
        matterReference: doc.matterReference,
        documentId: doc.id,
        action: 'accessed',
        targetName: doc.title,
        details: `Viewed metadata and custody record (${req.user.title})`,
      }).catch(console.error);
    }

    if (!userHasAccess) {
      // Return metadata for request workflow but mask version storage paths
      res.json({
        data: {
          ...doc,
          versions: [],
          currentVersion: {
            ...doc.currentVersion,
            storagePath: '',
            sha256Hash: '',
          },
          userHasAccess: false,
          accessRequestStatus,
          approvedUntil,
          isArchivedMatter,
        },
      });
      return;
    }

    res.json({
      data: {
        ...doc,
        userHasAccess: true,
        accessRequestStatus,
        approvedUntil,
        isArchivedMatter,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve document', message: error.message });
  }
});

// GET /api/documents/:documentId/versions
router.get('/:documentId/versions', validate(documentIdParamSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doc = await documentService.getDocumentById(req.params.documentId);
    if (!doc) {
      res.status(404).json({ error: 'Not Found', message: `Document ${req.params.documentId} not found` });
      return;
    }

    // Security check: Matter access clearance
    if (req.user && req.user.role !== 'workspace_admin' && req.user.role !== 'auditor') {
      const hasAccess = await matterService.checkUserMatterAccess(req.user.id, doc.matterId);
      if (!hasAccess) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied: You are not assigned to the matter associated with this document.',
        });
        return;
      }
    }

    // Security check: Restricted document clearance
    if (req.user) {
      const clearance = await restrictedAccessService.checkUserDocumentAccess(req.user, doc);
      if (!clearance.hasAccess) {
        res.status(403).json({
          error: 'Forbidden',
          message: clearance.reason || 'Access denied: Restricted document versions require clearance.',
        });
        return;
      }
    }

    const versions = await versionService.getVersionsForDocument(req.params.documentId);
    res.json({ data: versions, total: versions?.length || 0 });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve versions', message: error.message });
  }
});

// GET /api/documents/:documentId/versions/:versionId
router.get(
  '/:documentId/versions/:versionId',
  validate(versionParamSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const doc = await documentService.getDocumentById(req.params.documentId);
      if (!doc) {
        res.status(404).json({ error: 'Not Found', message: `Document ${req.params.documentId} not found` });
        return;
      }

      // Security check: Matter access clearance
      if (req.user && req.user.role !== 'workspace_admin' && req.user.role !== 'auditor') {
        const hasAccess = await matterService.checkUserMatterAccess(req.user.id, doc.matterId);
        if (!hasAccess) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied: You are not assigned to the matter associated with this document.',
          });
          return;
        }
      }

      // Security check: Restricted document clearance
      if (req.user) {
        const clearance = await restrictedAccessService.checkUserDocumentAccess(req.user, doc);
        if (!clearance.hasAccess) {
          res.status(403).json({
            error: 'Forbidden',
            message: clearance.reason || 'Access denied: Restricted document version requires clearance.',
          });
          return;
        }
      }

      const version = await versionService.getVersionById(req.params.documentId, req.params.versionId);
      if (!version) {
        res.status(404).json({ error: 'Not Found', message: 'Version not found' });
        return;
      }
      res.json({ data: version });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve version', message: error.message });
    }
  }
);


// POST /api/documents/import-sample
router.post(
  '/import-sample',
  requireRole('workspace_admin', 'attorney'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { sampleFilename, matterId, title, classification, allowArchivedSampleImport } = req.body;

      if (!sampleFilename || !matterId) {
        res.status(400).json({ error: 'Bad Request', message: 'sampleFilename and matterId are required' });
        return;
      }

      const projectSampleDir = path.resolve(process.cwd(), 'sample-data/cases');
      const fallbackDir = path.resolve('c:/Users/sa485/Downloads/Sample Cases');
      const safeFilename = path.basename(sampleFilename);
      const filePath = fs.existsSync(path.join(projectSampleDir, safeFilename))
        ? path.join(projectSampleDir, safeFilename)
        : path.join(fallbackDir, safeFilename);

      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'Not Found', message: `Sample file "${safeFilename}" not found` });
        return;
      }

      const matter = await matterService.getMatterById(matterId);
      if (!matter) {
        res.status(404).json({ error: 'Not Found', message: `Matter ${matterId} not found` });
        return;
      }

      if (user.role !== 'workspace_admin') {
        const hasAccess = await matterService.checkUserMatterAccess(user.id, matter.id);
        if (!hasAccess) {
          res.status(403).json({ error: 'Forbidden', message: 'Access denied: You are not assigned to this matter.' });
          return;
        }
      }

      // Archived matter protection (TASK 9)
      const isArchived = await matterService.isMatterArchived(matter.id);
      if (isArchived && !allowArchivedSampleImport && user.role !== 'workspace_admin') {
        res.status(403).json({
          error: 'Forbidden',
          message: `Matter "${matter.referenceCode}" is archived and locked for regulatory compliance. New uploads are prohibited.`,
        });
        return;
      }

      const fileBuffer = fs.readFileSync(filePath);
      const sha256Hash = computeSha256(fileBuffer);
      const cleanFilename = safeFilename.replace(/[^a-zA-Z0-9._-]/g, '_');

      // Check if document already exists with this hash (PART 10: Deduplication)
      const { data: existingVer } = await supabaseAdmin
        .from('document_versions')
        .select('id, document_id, version_number, storage_path')
        .eq('sha256_checksum', sha256Hash)
        .maybeSingle();

      if (existingVer) {
        const existingDoc = await documentService.getDocumentById(existingVer.document_id);
        if (existingDoc) {
          res.status(200).json({
            success: true,
            message: `Sample evidence "${existingDoc.title}" already verified in custodial ledger.`,
            data: existingDoc,
            alreadyImported: true,
          });
          return;
        }
      }

      const docUuid = crypto.randomUUID();
      const storagePath = `matters/${matter.referenceCode}/doc-${docUuid}/v1/${cleanFilename}`;

      const uploadRes = await storageService.uploadFile(storagePath, fileBuffer, 'application/pdf');
      if (uploadRes.error) {
        res.status(500).json({ error: 'Storage Error', message: `Failed to upload file to storage: ${uploadRes.error}` });
        return;
      }

      const docTitle = title?.trim() || safeFilename;
      const validClassifications = ['privileged', 'confidential', 'internal', 'public', 'restricted'];
      const docClassification = validClassifications.includes(classification) ? classification : 'confidential';

      let createdDoc;
      try {
        createdDoc = await documentService.createDocument({
          matterId: matter.id,
          matterReference: matter.referenceCode,
          matterTitle: matter.title,
          title: docTitle,
          classification: docClassification,
          reviewStatus: 'needs_review',
          tags: ['sample-evidence'],
          creatorId: user.id,
          creatorName: user.fullName,
          filename: safeFilename,
          storagePath,
          fileSizeBytes: fileBuffer.length,
          mimeType: 'application/pdf',
          sha256Hash,
          changeSummary: 'Imported from verified case files',
        });
      } catch (dbErr: any) {
        await storageService.deleteFile(storagePath);
        res.status(500).json({ error: 'Database Error', message: `Failed to record document: ${dbErr.message}` });
        return;
      }

      await auditService.logEvent({
        actorId: user.id,
        actorName: user.fullName,
        actorInitials: user.initials,
        matterId: matter.id,
        matterReference: matter.referenceCode,
        documentId: createdDoc.id,
        action: 'uploaded',
        targetName: createdDoc.title,
        details: `Imported evidence file ${cleanFilename} (${Math.round(fileBuffer.length / 1024)} KB) · SHA-256: ${sha256Hash.substring(0, 16)}...`,
        metadata: {
          sha256: sha256Hash,
          storagePath,
          version: 1,
          imported: true,
        },
      });

      res.status(201).json({
        success: true,
        message: `Sample evidence "${createdDoc.title}" registered in custodial ledger.`,
        data: createdDoc,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Server Error', message: err.message });
    }
  }
);

// POST /api/documents/upload - Real evidence binary file upload
router.post(
  '/upload',
  requireRole('workspace_admin', 'attorney', 'investigating_officer'),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      let fileBuffer: Buffer | null = null;
      let filename = '';
      let mimeType = 'application/pdf';

      if (req.file) {
        fileBuffer = req.file.buffer;
        filename = req.file.originalname;
        mimeType = req.file.mimetype || 'application/pdf';
      } else if (req.body.fileBase64 && req.body.filename) {
        fileBuffer = Buffer.from(req.body.fileBase64, 'base64');
        filename = req.body.filename;
        mimeType = req.body.mimeType || 'application/pdf';
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        res.status(400).json({ error: 'Bad Request', message: 'No file uploaded or file is empty' });
        return;
      }

      // Check max file size (100MB)
      if (fileBuffer.length > 104857600) {
        res.status(400).json({ error: 'Bad Request', message: 'File exceeds maximum 100MB size limit' });
        return;
      }

      // Check extension
      const fileExt = (filename.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(fileExt)) {
        res.status(400).json({
          error: 'Bad Request',
          message: `Unsupported file type ".${fileExt}". Allowed formats: PDF, DOCX, XLSX, CSV, TXT, TIFF, PNG, JPEG.`,
        });
        return;
      }

      // Normalize mimeType if generic octet-stream
      if (mimeType === 'application/octet-stream') {
        if (fileExt === 'pdf') mimeType = 'application/pdf';
        else if (fileExt === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (fileExt === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        else if (fileExt === 'csv') mimeType = 'text/csv';
        else if (fileExt === 'txt') mimeType = 'text/plain';
        else if (fileExt === 'tiff' || fileExt === 'tif') mimeType = 'image/tiff';
        else if (fileExt === 'png') mimeType = 'image/png';
        else if (fileExt === 'jpg' || fileExt === 'jpeg') mimeType = 'image/jpeg';
      }

      // MIME type verification
      const allowedMimes: Record<string, string[]> = {
        pdf: ['application/pdf'],
        docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
        xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
        csv: ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'],
        txt: ['text/plain'],
        tiff: ['image/tiff', 'image/x-tiff'],
        tif: ['image/tiff', 'image/x-tiff'],
        png: ['image/png'],
        jpeg: ['image/jpeg', 'image/pjpeg'],
        jpg: ['image/jpeg', 'image/pjpeg'],
      };

      if (allowedMimes[fileExt]) {
        const expected = allowedMimes[fileExt];
        if (!expected.includes(mimeType) && !expected.some((e) => mimeType.startsWith(e))) {
          res.status(400).json({
            error: 'Bad Request',
            message: `MIME type "${mimeType}" does not match file extension ".${fileExt}".`,
          });
          return;
        }
      }

      // Deep binary header / magic bytes verification (TASK 3)
      const sigCheck = validateBufferSignature(fileBuffer, fileExt);
      if (!sigCheck.valid) {
        res.status(400).json({
          error: 'Bad Request',
          message: sigCheck.reason || 'File header does not match declared file extension.',
        });
        return;
      }

      const matterId = req.body.matterId;
      if (!matterId) {
        res.status(400).json({ error: 'Bad Request', message: 'matterId is required' });
        return;
      }

      // Verify matter exists
      const matter = await matterService.getMatterById(matterId);
      if (!matter) {
        res.status(404).json({ error: 'Not Found', message: `Matter ${matterId} not found` });
        return;
      }

      // Authorization check (TASK 6)
      if (user.role !== 'workspace_admin') {
        const hasAccess = await matterService.checkUserMatterAccess(user.id, matter.id);
        if (!hasAccess) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied: You are not assigned to this matter.',
          });
          return;
        }
      }

      // Archived matter protection (TASK 9)
      const isArchived = await matterService.isMatterArchived(matter.id);
      if (isArchived) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Matter "${matter.referenceCode}" is archived and locked for regulatory compliance. New uploads are prohibited.`,
        });
        return;
      }

      // Calculate cryptographic SHA-256 (TASK 3)
      const sha256Hash = computeSha256(fileBuffer);

      // Title & classification
      const title = req.body.title?.trim() || filename.replace(/\.[^/.]+$/, '');
      const validClassifications = ['privileged', 'confidential', 'internal', 'public', 'restricted'];
      const classification = validClassifications.includes(req.body.classification)
        ? req.body.classification
        : 'confidential';

      const changeSummary = req.body.changeSummary || 'Initial document upload';
      const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const docUuid = crypto.randomUUID();
      const storagePath = `matters/${matter.referenceCode}/doc-${docUuid}/v1/${cleanFilename}`;

      // Upload binary to Supabase Storage (TASK 2)
      const uploadRes = await storageService.uploadFile(storagePath, fileBuffer, mimeType);
      if (uploadRes.error) {
        console.error('Storage upload failed:', uploadRes.error);
        res.status(500).json({ error: 'Storage Error', message: `Failed to upload file to storage: ${uploadRes.error}` });
        return;
      }

      // Document persistence in PostgreSQL (TASK 4 & 5)
      let createdDoc;
      try {
        createdDoc = await documentService.createDocument({
          matterId: matter.id,
          matterReference: matter.referenceCode,
          matterTitle: matter.title,
          title,
          classification,
          reviewStatus: 'needs_review',
          tags: req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags]) : [],
          creatorId: user.id,
          creatorName: user.fullName,
          filename: cleanFilename,
          storagePath,
          fileSizeBytes: fileBuffer.length,
          mimeType,
          sha256Hash,
          changeSummary,
        });
      } catch (dbErr: any) {
        console.error('Database persistence failed after storage upload, rolling back storage:', dbErr);
        // Rollback uploaded file to avoid orphaned storage objects (TASK 12)
        await storageService.deleteFile(storagePath);
        res.status(500).json({
          error: 'Database Error',
          message: `Failed to persist document metadata to database: ${dbErr.message}`,
        });
        return;
      }

      // Audit event (TASK 8 & 10)
      try {
        await auditService.logEvent({
          actorId: user.id,
          actorName: user.fullName,
          actorInitials: user.initials,
          matterId: matter.id,
          matterReference: matter.referenceCode,
          documentId: createdDoc.id,
          action: 'uploaded',
          targetName: createdDoc.title,
          details: `Uploaded evidence file ${cleanFilename} (${Math.round(fileBuffer.length / 1024)} KB, SHA-256: ${sha256Hash.substring(0, 16)}...)`,
          metadata: {
            filename: cleanFilename,
            version: 1,
            size: fileBuffer.length,
            fileSize: fileBuffer.length,
            classification,
            matter: matter.referenceCode,
            sha256: sha256Hash,
            storagePath,
            mimeType,
          },
        });
      } catch (auditErr: any) {
        console.error('Audit log warning:', auditErr);
      }

      res.status(201).json({
        success: true,
        message: `Evidence file "${createdDoc.title}" uploaded and registered in custodial ledger.`,
        data: createdDoc,
      });
    } catch (error: any) {
      console.error('Upload endpoint error:', error);
      res.status(500).json({ error: 'Server Error', message: error.message });
    }
  }
);

// POST /api/documents/:documentId/upload-version - Real evidence version binary file upload
router.post(
  '/:documentId/upload-version',
  requireRole('workspace_admin', 'attorney'),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const doc = await documentService.getDocumentById(req.params.documentId);
      if (!doc) {
        res.status(404).json({ error: 'Not Found', message: 'Document not found' });
        return;
      }

      // Matter access check
      if (user.role !== 'workspace_admin') {
        const hasAccess = await matterService.checkUserMatterAccess(user.id, doc.matterId);
        if (!hasAccess) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied: You are not assigned to the matter associated with this document.',
          });
          return;
        }
      }

      // Archived matter protection (TASK 9)
      const isArchived = await matterService.isMatterArchived(doc.matterId);
      if (isArchived) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Matter "${doc.matterReference}" is archived and locked for regulatory compliance. New versions cannot be added.`,
        });
        return;
      }

      // Restricted document clearance check (TASK 4)
      const clearance = await restrictedAccessService.checkUserDocumentAccess(user, doc);
      if (!clearance.hasAccess) {
        res.status(403).json({
          error: 'Forbidden',
          message: clearance.reason || 'Access denied: Restricted document version upload requires clearance.',
        });
        return;
      }

      let fileBuffer: Buffer | null = null;
      let filename = '';
      let mimeType = 'application/pdf';

      if (req.file) {
        fileBuffer = req.file.buffer;
        filename = req.file.originalname;
        mimeType = req.file.mimetype || 'application/pdf';
      } else if (req.body.fileBase64 && req.body.filename) {
        fileBuffer = Buffer.from(req.body.fileBase64, 'base64');
        filename = req.body.filename;
        mimeType = req.body.mimeType || 'application/pdf';
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        res.status(400).json({ error: 'Bad Request', message: 'No file uploaded or file is empty' });
        return;
      }

      const fileExt = (filename.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(fileExt)) {
        res.status(400).json({
          error: 'Bad Request',
          message: `Unsupported file type ".${fileExt}". Allowed formats: PDF, DOCX, XLSX, CSV, TXT, TIFF, PNG, JPEG.`,
        });
        return;
      }

      const sha256Hash = computeSha256(fileBuffer);
      const nextVersion = doc.currentVersionNumber + 1;
      const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `matters/${doc.matterReference}/doc-${doc.id}/v${nextVersion}/${cleanFilename}`;

      const uploadRes = await storageService.uploadFile(storagePath, fileBuffer, mimeType);
      if (uploadRes.error) {
        res.status(500).json({ error: 'Storage Error', message: `Failed to upload version: ${uploadRes.error}` });
        return;
      }

      let result;
      try {
        result = await documentService.addDocumentVersion(doc.id, {
          originalFilename: cleanFilename,
          storagePath,
          fileSizeBytes: fileBuffer.length,
          mimeType,
          sha256Hash,
          uploadedBy: user.id,
          uploadedByName: user.fullName,
          changeSummary: req.body.changeSummary || `Uploaded version ${nextVersion}`,
        });
      } catch (dbErr: any) {
        await storageService.deleteFile(storagePath);
        res.status(500).json({ error: 'Database Error', message: `Failed to record version: ${dbErr.message}` });
        return;
      }

      await auditService.logEvent({
        actorId: user.id,
        actorName: user.fullName,
        actorInitials: user.initials,
        matterId: doc.matterId,
        matterReference: doc.matterReference,
        documentId: doc.id,
        action: 'version_bumped',
        targetName: doc.title,
        details: `Uploaded version ${nextVersion} (${cleanFilename}) · SHA-256: ${sha256Hash.substring(0, 16)}...`,
        metadata: {
          version: nextVersion,
          sha256: sha256Hash,
          storagePath,
        },
      });

      res.status(201).json({
        success: true,
        message: `Version ${nextVersion} uploaded for "${doc.title}"`,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Server Error', message: error.message });
    }
  }
);

// POST /api/documents
router.post(
  '/',
  requireRole('workspace_admin', 'attorney', 'investigating_officer'),
  validate(createDocumentBodySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const body = req.body;

      if (user.role !== 'workspace_admin') {
        const hasAccess = await matterService.checkUserMatterAccess(user.id, body.matterId);
        if (!hasAccess) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied: You are not assigned to this matter.',
          });
          return;
        }
      }

      const storagePath =
        body.storagePath ||
        `evidence-documents/matters/${body.matterReference}/docs/${body.filename}`;

      const created = await documentService.createDocument({
        ...body,
        creatorId: user.id,
        creatorName: user.fullName,
        storagePath,
      });

      // Audit event
      await auditService.logEvent({
        actorId: user.id,
        actorName: user.fullName,
        actorInitials: user.initials,
        matterId: body.matterId,
        matterReference: body.matterReference,
        documentId: created.id,
        action: 'uploaded',
        targetName: created.title,
        details: `Initial document upload (${body.filename})`,
      });

      res.status(201).json({ data: created });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to create document', message: error.message });
    }
  }
);

// POST /api/documents/:documentId/versions
router.post(
  '/:documentId/versions',
  requireRole('workspace_admin', 'attorney'),
  validate(addVersionBodySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const doc = await documentService.getDocumentById(req.params.documentId);
      if (!doc) {
        res.status(404).json({ error: 'Not Found', message: 'Document not found' });
        return;
      }

      if (user.role !== 'workspace_admin') {
        const hasAccess = await matterService.checkUserMatterAccess(user.id, doc.matterId);
        if (!hasAccess) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied: You are not assigned to the matter associated with this document.',
          });
          return;
        }
      }

      // Archived matter protection (TASK 9)
      const isArchived = await matterService.isMatterArchived(doc.matterId);
      if (isArchived) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Matter "${doc.matterReference}" is archived and locked for regulatory compliance. New versions cannot be added.`,
        });
        return;
      }

      // Restricted document clearance check (TASK 4)
      const clearance = await restrictedAccessService.checkUserDocumentAccess(user, doc);
      if (!clearance.hasAccess) {
        res.status(403).json({
          error: 'Forbidden',
          message: clearance.reason || 'Access denied: Restricted document version upload requires clearance.',
        });
        return;
      }

      const storagePath =
        req.body.storagePath ||
        `evidence-documents/matters/${doc.matterReference}/doc-${doc.id}/v${doc.currentVersionNumber + 1}/${req.body.filename}`;

      const result = await documentService.addDocumentVersion(doc.id, {
        originalFilename: req.body.filename,
        storagePath,
        fileSizeBytes: req.body.fileSizeBytes,
        mimeType: req.body.mimeType,
        sha256Hash: req.body.sha256Hash,
        uploadedBy: user.id,
        uploadedByName: user.fullName,
        changeSummary: req.body.changeSummary,
      });

      if (!result) {
        res.status(500).json({ error: 'Failed to add version' });
        return;
      }

      await auditService.logEvent({
        actorId: user.id,
        actorName: user.fullName,
        actorInitials: user.initials,
        matterId: doc.matterId,
        matterReference: doc.matterReference,
        documentId: doc.id,
        action: 'version_bumped',
        targetName: doc.title,
        details: `Uploaded version ${result.version.versionNumber}: ${req.body.changeSummary}`,
        metadata: { version: result.version.versionNumber },
      });

      res.status(201).json({ data: result });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to add version', message: error.message });
    }
  }
);

// POST /api/documents/:documentId/reviews
router.post(
  '/:documentId/reviews',
  requireRole('workspace_admin', 'attorney'),
  validate(reviewBodySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { status, decisionNotes } = req.body;

      const doc = await documentService.getDocumentById(req.params.documentId);
      if (!doc) {
        res.status(404).json({ error: 'Not Found', message: 'Document not found' });
        return;
      }

      if (user.role !== 'workspace_admin') {
        const hasAccess = await matterService.checkUserMatterAccess(user.id, doc.matterId);
        if (!hasAccess) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied: You are not assigned to the matter associated with this document.',
          });
          return;
        }
      }

      // Archived matter protection (TASK 9)
      const isArchived = await matterService.isMatterArchived(doc.matterId);
      if (isArchived) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Matter "${doc.matterReference}" is archived and locked for regulatory compliance. Review decisions cannot be modified.`,
        });
        return;
      }

      const result = await reviewService.submitReview({
        documentId: req.params.documentId,
        reviewer: user,
        status,
        decisionNotes,
      });

      if (!result) {
        res.status(404).json({ error: 'Not Found', message: 'Document not found' });
        return;
      }

      res.json({
        success: true,
        message: `Review certified for "${result.documentTitle}"`,
        data: result.reviewRecord,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to submit review', message: error.message });
    }
  }
);

// GET /api/documents/:documentId/download
router.get(
  '/:documentId/download',
  validate(documentIdParamSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const doc = await documentService.getDocumentById(req.params.documentId);
      if (!doc) {
        res.status(404).json({ error: 'Not Found', message: 'Document not found' });
        return;
      }

      // Security check: Matter access clearance
      if (user.role !== 'workspace_admin' && user.role !== 'auditor') {
        const hasAccess = await matterService.checkUserMatterAccess(user.id, doc.matterId);
        if (!hasAccess) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied: You are not assigned to the matter associated with this document.',
          });
          return;
        }
      }

      // Security check: Restricted document clearance (TASK 4 & TASK 8)
      const clearance = await restrictedAccessService.checkUserDocumentAccess(user, doc);
      if (!clearance.hasAccess) {
        res.status(403).json({
          error: 'Forbidden',
          message: clearance.reason || 'Access denied: Restricted document requires Workspace Administrator or Lead Attorney clearance.',
        });
        return;
      }

      // Identify version to download (query param ?version=X or current)
      const requestedVersionNum = req.query.version ? parseInt(req.query.version as string, 10) : undefined;
      const targetVersion = requestedVersionNum
        ? doc.versions.find((v) => v.versionNumber === requestedVersionNum) || doc.currentVersion
        : doc.currentVersion;

      // Generate signed URL via Supabase Storage
      const { signedUrl, expiresAt } = await storageService.generateSignedUrl(
        targetVersion.storagePath,
        300, // 5 minutes TTL
        targetVersion.originalFilename
      );

      // Log download security event
      const securityEvent = await auditService.logDownloadEvent({
        documentId: doc.id,
        documentTitle: doc.title,
        versionNumber: targetVersion.versionNumber,
        userId: user.id,
        userName: user.fullName,
        matterReference: doc.matterReference,
        signedUrlExpiresAt: expiresAt,
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      });

      // Also append to standard audit trail
      await auditService.logEvent({
        actorId: user.id,
        actorName: user.fullName,
        actorInitials: user.initials,
        matterId: doc.matterId,
        matterReference: doc.matterReference,
        documentId: doc.id,
        action: 'accessed',
        targetName: doc.title,
        details: `Signed URL issued for v${targetVersion.versionNumber} (300s TTL) · ${user.fullName} (${user.title})`,
        metadata: {
          version: targetVersion.versionNumber,
          expiresAt,
          eventId: securityEvent.id,
        },
      });

      res.json({
        documentId: doc.id,
        title: doc.title,
        versionNumber: targetVersion.versionNumber,
        filename: targetVersion.originalFilename,
        fileSizeFormatted: targetVersion.fileSizeFormatted,
        sha256Hash: targetVersion.sha256Hash,
        signedUrl,
        expiresAt,
        ttlSeconds: 300,
        securityEventId: securityEvent.id,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate download URL', message: error.message });
    }
  }
);

// POST /api/documents/:documentId/request-access
router.post(
  '/:documentId/request-access',
  validate(
    z.object({
      params: z.object({ documentId: z.string().min(1) }),
      body: z.object({ reason: z.string().min(5, 'A clear legal reason is required (min 5 characters)') }),
    })
  ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const result = await restrictedAccessService.createRequest({
        documentId: req.params.documentId,
        requester: user,
        reason: req.body.reason,
      });
      res.status(201).json({
        success: true,
        message: 'Restricted access request submitted for lead counsel review.',
        data: result,
      });
    } catch (error: any) {
      const status = error.statusCode || 500;
      res.status(status).json({
        error: status === 403 ? 'Forbidden' : status === 409 ? 'Conflict' : 'Server Error',
        message: error.message,
      });
    }
  }
);

// POST /api/documents/:documentId/signed-url
router.post(
  '/:documentId/signed-url',
  validate(documentIdParamSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const doc = await documentService.getDocumentById(req.params.documentId);
      if (!doc) {
        res.status(404).json({ error: 'Not Found', message: 'Document not found' });
        return;
      }

      // Security check: Matter access clearance
      if (user.role !== 'workspace_admin' && user.role !== 'auditor') {
        const hasAccess = await matterService.checkUserMatterAccess(user.id, doc.matterId);
        if (!hasAccess) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied: You are not assigned to the matter associated with this document.',
          });
          return;
        }
      }

      // Security check: Restricted document clearance
      const clearance = await restrictedAccessService.checkUserDocumentAccess(user, doc);
      if (!clearance.hasAccess) {
        res.status(403).json({
          error: 'Forbidden',
          message: clearance.reason || 'Access to restricted document requires elevated clearance.',
        });
        return;
      }

      // Security check: Confidential/Restricted file password verification
      const isConfidentialOrRestricted =
        doc.classification.toLowerCase() === 'confidential' ||
        doc.classification.toLowerCase() === 'restricted';

      if (isConfidentialOrRestricted) {
        const expectedPassword = config.CONFIDENTIAL_FILE_PASSWORD || '123456';
        const providedPassword = req.body?.password;

        if (!providedPassword || providedPassword !== expectedPassword) {
          // Audit verification failure WITHOUT recording the password
          await auditService.logEvent({
            actorId: user.id,
            actorName: user.fullName,
            actorInitials: user.initials,
            matterId: doc.matterId,
            matterReference: doc.matterReference,
            documentId: doc.id,
            action: 'security_alert',
            targetName: doc.title,
            details: `Confidential file password verification failed (incorrect password entered) · ${user.fullName}`,
            metadata: {
              classification: doc.classification,
              verificationSuccess: false,
            },
          });

          res.status(403).json({
            error: 'Forbidden',
            message: 'Incorrect confidential file password.',
          });
          return;
        }

        // Audit verification success WITHOUT recording the password
        await auditService.logEvent({
          actorId: user.id,
          actorName: user.fullName,
          actorInitials: user.initials,
          matterId: doc.matterId,
          matterReference: doc.matterReference,
          documentId: doc.id,
          action: 'accessed',
          targetName: doc.title,
          details: `Confidential file password verified successfully · ${user.fullName}`,
          metadata: {
            classification: doc.classification,
            verificationSuccess: true,
          },
        });
      }

      const requestedVersionNum = req.body?.versionNumber || req.query?.version
        ? parseInt((req.body?.versionNumber || req.query?.version) as string, 10)
        : undefined;
      const targetVersion = requestedVersionNum
        ? doc.versions.find((v) => v.versionNumber === requestedVersionNum) || doc.currentVersion
        : doc.currentVersion;

      const ttl = req.body?.expiresInSeconds || 300;
      const { signedUrl, expiresAt } = await storageService.generateSignedUrl(
        targetVersion.storagePath,
        ttl,
        targetVersion.originalFilename
      );

      // Log download event
      const securityEvent = await auditService.logDownloadEvent({
        documentId: doc.id,
        documentTitle: doc.title,
        versionNumber: targetVersion.versionNumber,
        userId: user.id,
        userName: user.fullName,
        matterReference: doc.matterReference,
        signedUrlExpiresAt: expiresAt,
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      });

      // Audit trail
      await auditService.logEvent({
        actorId: user.id,
        actorName: user.fullName,
        actorInitials: user.initials,
        matterId: doc.matterId,
        matterReference: doc.matterReference,
        documentId: doc.id,
        action: 'accessed',
        targetName: doc.title,
        details: `Signed URL issued for v${targetVersion.versionNumber} (${ttl}s TTL) · ${user.fullName}`,
        metadata: { version: targetVersion.versionNumber, expiresAt, eventId: securityEvent.id },
      });

      res.json({
        documentId: doc.id,
        title: doc.title,
        versionNumber: targetVersion.versionNumber,
        filename: targetVersion.originalFilename,
        fileSizeFormatted: targetVersion.fileSizeFormatted,
        sha256Hash: targetVersion.sha256Hash,
        signedUrl,
        expiresAt,
        ttlSeconds: ttl,
        securityEventId: securityEvent.id,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate signed URL', message: error.message });
    }
  }
);

export default router;
