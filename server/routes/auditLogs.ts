import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { auditService } from '../services/auditService';
import { validate } from '../middleware/validate';

const router = Router();

const auditLogsQuerySchema = z.object({
  query: z.object({
    matterId: z.string().optional(),
    documentId: z.string().optional(),
    limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 50)),
    offset: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 0)),
  }),
});

const exportQuerySchema = z.object({
  query: z.object({
    format: z.enum(['csv', 'json']).default('csv'),
    matterId: z.string().optional(),
  }),
});

// GET /api/audit-logs
router.get('/', validate(auditLogsQuerySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role === 'victim') {
      res.status(403).json({ error: 'Forbidden', message: 'Access denied: Victims do not have clearance to inspect workspace audit logs.' });
      return;
    }

    const { matterId, documentId, limit, offset } = req.query as any;
    const result = await auditService.getAuditLogs({
      matterId,
      documentId,
      limit,
      offset,
    });

    res.json({
      data: result.data,
      total: result.total,
      limit,
      offset,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve audit trail', message: error.message });
  }
});

// GET /api/audit-logs/export
router.get('/export', validate(exportQuerySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.role === 'victim') {
      res.status(403).json({ error: 'Forbidden', message: 'Access denied: Victims cannot export workspace audit logs.' });
      return;
    }

    const { format, matterId } = req.query as any;

    const result = await auditService.exportAuditLogs({
      actor: user,
      matterId,
      format: format || 'csv',
      ipAddress: req.ip,
    });

    res.setHeader('Content-Type', result.format === 'json' ? 'application/json' : 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Audit-Integrity-SHA256', result.integrityHash);
    res.setHeader('X-Audit-Record-Count', String(result.recordCount));

    res.send(result.content);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({
      error: status === 403 ? 'Forbidden' : 'Server Error',
      message: error.message,
    });
  }
});

// GET /api/audit-logs/security-events
router.get('/security-events', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role === 'victim') {
      res.status(403).json({ error: 'Forbidden', message: 'Access denied: Victims cannot view security events.' });
      return;
    }

    const events = await auditService.getDownloadEvents();
    res.json({
      data: events,
      total: events.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve download security events', message: error.message });
  }
});

export default router;
