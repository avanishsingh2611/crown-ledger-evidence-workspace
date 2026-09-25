import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../types';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required before accessing this resource.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Your role (${req.user.role}) does not have permission to perform this action. Required: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}
