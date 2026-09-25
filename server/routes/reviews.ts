import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { reviewService } from '../services/reviewService';

const router = Router();

// GET /api/reviews
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId, status } = req.query as { documentId?: string; status?: string };
    const reviews = await reviewService.getAllReviews({ documentId, status });
    res.json({
      data: reviews,
      total: reviews.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve reviews', message: error.message });
  }
});

export default router;
