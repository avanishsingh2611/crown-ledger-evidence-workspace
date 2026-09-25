import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { restrictedAccessService } from '../services/restrictedAccessService';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/rbac';

const router = Router();

const createRequestSchema = z.object({
  body: z.object({
    documentId: z.string().min(1, 'Document ID is required'),
    reason: z.string().min(5, 'A clear legal reason for access is required (min 5 characters)'),
  }),
});

const decideRequestSchema = z.object({
  params: z.object({
    requestId: z.string().min(1, 'Request ID is required'),
  }),
  body: z.object({
    decision: z.enum(['approved', 'denied']),
    decisionNote: z.string().min(3, 'Decision note is required for legal audit trail'),
    approvedUntil: z.string().optional(),
  }),
});

// GET /api/restricted-access/requests
router.get('/requests', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const matterId = typeof req.query.matterId === 'string' ? req.query.matterId : undefined;

    const requests = await restrictedAccessService.getRequests({ status, matterId }, user);
    res.json({ data: requests, total: requests.length });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch access requests', message: error.message });
  }
});

// POST /api/restricted-access/requests
router.post(
  '/requests',
  validate(createRequestSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { documentId, reason } = req.body;

      const request = await restrictedAccessService.createRequest({
        documentId,
        requester: user,
        reason,
      });

      res.status(201).json({
        success: true,
        message: 'Restricted access request submitted for lead counsel review.',
        data: request,
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

// POST /api/restricted-access/requests/:requestId/decision
router.post(
  '/requests/:requestId/decision',
  requireRole('workspace_admin', 'attorney'),
  validate(decideRequestSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { requestId } = req.params;
      const { decision, decisionNote, approvedUntil } = req.body;

      const result = await restrictedAccessService.decideRequest({
        requestId,
        reviewer: user,
        decision,
        decisionNote,
        approvedUntil,
      });

      res.json({
        success: true,
        message: `Restricted access request ${decision} successfully.`,
        data: result,
      });
    } catch (error: any) {
      const status = error.statusCode || 500;
      res.status(status).json({
        error: status === 403 ? 'Forbidden' : status === 404 ? 'Not Found' : 'Server Error',
        message: error.message,
      });
    }
  }
);

export default router;
