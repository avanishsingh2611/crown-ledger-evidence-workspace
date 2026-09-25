import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { matterService } from '../services/matterService';
import { validate } from '../middleware/validate';
import { requireMatterAccess } from '../middleware/matterAuth';

const router = Router();

const matterParamSchema = z.object({
  params: z.object({
    matterId: z.string().min(1, 'Matter ID or reference code required'),
  }),
});

// GET /api/matters
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const matters = req.user
      ? await matterService.getMattersForUser(req.user)
      : await matterService.getAllMatters();
    res.json({
      data: matters,
      total: matters.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch matters', message: error.message });
  }
});

// GET /api/matters/:matterId
router.get(
  '/:matterId',
  validate(matterParamSchema),
  requireMatterAccess(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const matter = await matterService.getMatterById(req.params.matterId);
      if (!matter) {
        res.status(404).json({ error: 'Not Found', message: `Matter ${req.params.matterId} not found` });
        return;
      }
      res.json({ data: matter });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch matter', message: error.message });
    }
  }
);

export default router;
