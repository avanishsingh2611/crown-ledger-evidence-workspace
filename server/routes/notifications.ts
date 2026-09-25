import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { notificationService } from '../services/notificationService';
import { validate } from '../middleware/validate';
import { notificationIdParamSchema } from '../validation/sihSchemas';

const router = Router();

// GET /api/notifications - List user's notifications
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const unreadOnly = req.query.unread === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const notifications = await notificationService.getUserNotifications(user, { unreadOnly, limit });
    res.json({
      data: notifications,
      total: notifications.length,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', validate(notificationIdParamSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const updated = await notificationService.markAsRead(req.params.id, user);
    res.json({ data: updated });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.name || 'Error', message: error.message });
  }
});

export default router;
