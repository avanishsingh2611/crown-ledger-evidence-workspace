import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { caseService } from '../services/caseService';
import { caseParticipantService } from '../services/caseParticipantService';
import { forensicService } from '../services/forensicService';
import { validate } from '../middleware/validate';
import {
  createCaseSchema,
  updateCaseSchema,
  caseIdParamSchema,
  addParticipantSchema,
  updateParticipantSchema,
  participantParamSchema,
  createForensicReportSchema,
} from '../validation/sihSchemas';

const router = Router();

// ==============================================================================
// COURT CASES ENDPOINTS
// ==============================================================================

// GET /api/cases - List authorized court cases
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const cases = await caseService.getCasesForUser(user);
    res.json({
      data: cases,
      total: cases.length,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
  }
});

// POST /api/cases - Create court case
router.post('/', validate(createCaseSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const created = await caseService.createCase(req.body, user, req.ip);
    res.status(201).json({ data: created });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
  }
});

// GET /api/cases/:id - Get court case details
router.get('/:id', validate(caseIdParamSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const caseRecord = await caseService.getCaseById(req.params.id, user);
    if (!caseRecord) {
      res.status(404).json({ error: 'Not Found', message: `Court case ${req.params.id} not found` });
      return;
    }
    res.json({ data: caseRecord });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
  }
});

// PATCH /api/cases/:id - Update court case
router.patch('/:id', validate(updateCaseSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const updated = await caseService.updateCase(req.params.id, req.body, user, req.ip);
    res.json({ data: updated });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
  }
});

// ==============================================================================
// CASE PARTICIPANTS ENDPOINTS
// ==============================================================================

// GET /api/cases/:id/participants - List participants for a case
router.get('/:id/participants', validate(caseIdParamSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const participants = await caseParticipantService.getParticipants(req.params.id, user);
    res.json({
      data: participants,
      total: participants.length,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
  }
});

// POST /api/cases/:id/participants - Add a participant
router.post('/:id/participants', validate(addParticipantSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const created = await caseParticipantService.addParticipant(req.params.id, req.body, user, req.ip);
    res.status(201).json({ data: created });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
  }
});

// PATCH /api/cases/:id/participants/:participantId - Update a participant
router.patch(
  '/:id/participants/:participantId',
  validate(updateParticipantSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }
      const updated = await caseParticipantService.updateParticipant(
        req.params.id,
        req.params.participantId,
        req.body,
        user,
        req.ip
      );
      res.json({ data: updated });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
    }
  }
);

// DELETE /api/cases/:id/participants/:participantId - Remove a participant
router.delete(
  '/:id/participants/:participantId',
  validate(participantParamSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }
      await caseParticipantService.removeParticipant(req.params.id, req.params.participantId, user, req.ip);
      res.status(204).send();
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
    }
  }
);

// ==============================================================================
// FORENSIC REPORTS (SCOPED UNDER CASE)
// ==============================================================================

// GET /api/cases/:id/forensic-reports - List reports for a case
router.get('/:id/forensic-reports', validate(caseIdParamSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const reports = await forensicService.getReportsForCase(req.params.id, user);
    res.json({
      data: reports,
      total: reports.length,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
  }
});

// POST /api/cases/:id/forensic-reports - Create a report for a case
router.post(
  '/:id/forensic-reports',
  validate(createForensicReportSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }
      const created = await forensicService.createReport(req.params.id, req.body, user, req.ip);
      res.status(201).json({ data: created });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
    }
  }
);

export default router;
