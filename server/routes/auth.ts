import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { KNOWN_PROFILES } from '../middleware/auth';

const router = Router();

// GET /api/auth/me
router.get('/me', (req: AuthenticatedRequest, res: Response) => {
  res.json({
    user: req.user,
    availableProfiles: Object.values(KNOWN_PROFILES),
  });
});

export default router;
