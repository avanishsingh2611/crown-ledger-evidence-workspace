import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

export function requestLogger(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const userDisplay = req.user ? `[${req.user.initials} - ${req.user.role}]` : '[ANON]';
    const status = res.statusCode;
    const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';
    console.log(`[API] ${color}${method} ${originalUrl} ${status}${reset} - ${duration}ms ${userDisplay}`);
  });

  next();
}
