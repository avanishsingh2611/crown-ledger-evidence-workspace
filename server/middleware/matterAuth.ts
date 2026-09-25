import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { matterService } from '../services/matterService';

export function requireMatterAccess() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      // Workspace admins and external compliance auditors have read-level access across matters
      if (user.role === 'workspace_admin' || user.role === 'auditor') {
        return next();
      }

      // Extract matterId from params, query, or body
      const matterId = (req.params.matterId || req.query.matterId || req.body.matterId) as string;
      if (!matterId) {
        // If no specific matter ID requested in route, proceed
        return next();
      }

      const matter = await matterService.getMatterById(matterId);
      if (!matter) {
        res.status(404).json({ error: 'Not Found', message: `Matter ${matterId} not found` });
        return;
      }

      // Check if user has access
      const hasAccess = await matterService.checkUserMatterAccess(user.id, matterId);
      if (!hasAccess) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Access denied to matter ${matter.referenceCode} (${matter.title}) under ethical wall policy.`,
        });
        return;
      }

      next();
    } catch (err) {
      console.error('Matter authorization error:', err);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to verify matter access' });
    }
  };
}
