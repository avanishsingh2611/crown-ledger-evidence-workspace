import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { custodyService } from '../services/custodyService';
import { validate } from '../middleware/validate';
import {
  documentCustodyParamSchema,
  recordCustodyTransferSchema,
} from '../validation/sihSchemas';

const router = Router({ mergeParams: true });

// GET /api/documents/:documentId/custody - View chain of custody ledger
router.get('/:documentId/custody', validate(documentCustodyParamSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const transfers = await custodyService.getCustodyHistory(req.params.documentId, user);
    res.json({
      data: transfers,
      total: transfers.length,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
  }
});

// POST /api/documents/:documentId/custody - Record an immutable custody transfer
router.post('/:documentId/custody', validate(recordCustodyTransferSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const created = await custodyService.recordTransfer(req.params.documentId, req.body, user, req.ip);
    res.status(201).json({ data: created });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
  }
});

export default router;
