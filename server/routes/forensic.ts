import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { forensicService } from '../services/forensicService';
import { validate } from '../middleware/validate';
import {
  reportIdParamSchema,
  updateForensicReportSchema,
} from '../validation/sihSchemas';

const router = Router();

// GET /api/forensic-reports/:id
router.get('/:id', validate(reportIdParamSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const report = await forensicService.getReportById(req.params.id, user);
    if (!report) {
      res.status(404).json({ error: 'Not Found', message: `Forensic report ${req.params.id} not found` });
      return;
    }
    res.json({ data: report });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
  }
});

// PATCH /api/forensic-reports/:id - Update draft report
router.patch('/:id', validate(updateForensicReportSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const updated = await forensicService.updateReport(req.params.id, req.body, user, req.ip);
    res.json({ data: updated });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
  }
});

// POST /api/forensic-reports/:id/finalize - Finalize report under Section 65B verification
router.post('/:id/finalize', validate(reportIdParamSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const finalized = await forensicService.finalizeReport(req.params.id, user, req.ip);
    res.json({ data: finalized });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
  }
});

export default router;
