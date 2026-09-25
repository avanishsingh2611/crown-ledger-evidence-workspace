import { Router, Response } from 'express';
import { AuthenticatedRequest, WorkspaceStats } from '../types';
import { documentService } from '../services/documentService';
import { matterService } from '../services/matterService';

const router = Router();

async function getStatsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const documents = await documentService.getAllDocuments();
    const matters = await matterService.getAllMatters();

    const totalDocuments = documents.length;
    const needsReview = documents.filter((d) => d.reviewStatus === 'needs_review').length;
    const reviewed = documents.filter((d) => d.reviewStatus === 'reviewed').length;
    const restricted = documents.filter((d) => d.reviewStatus === 'restricted').length;

    const matterCounts = matters.map((m) => {
      const files = documents.filter((d) => d.matterId === m.id);
      const unreviewed = files.filter((d) => d.reviewStatus === 'needs_review').length;
      return {
        referenceCode: m.referenceCode,
        matterTitle: m.title,
        matterId: m.id,
        fileCount: files.length,
        unreviewedCount: unreviewed,
      };
    });

    const stats: WorkspaceStats = {
      totalDocuments,
      needsReview,
      reviewed,
      restricted,
      matterCounts,
    };

    res.json({ data: stats });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to compute workspace statistics', message: error.message });
  }
}

// GET /api/stats
router.get('/', getStatsHandler);

// GET /api/overview
router.get('/overview', getStatsHandler);

export default router;
