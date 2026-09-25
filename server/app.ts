/*
 * Crown & Ledger Evidence Workspace
 * Copyright © 2026 Avanish Singh
 * Author: Avanish Singh
 */

import express, { Express } from 'express';
import cors from 'cors';
import { requestLogger } from './middleware/logger';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config';

// Route imports
import authRoutes from './routes/auth';
import matterRoutes from './routes/matters';
import caseRoutes from './routes/cases';
import forensicRoutes from './routes/forensic';
import notificationRoutes from './routes/notifications';
import custodyRoutes from './routes/custody';
import documentRoutes from './routes/documents';
import auditLogRoutes from './routes/auditLogs';
import statsRoutes from './routes/stats';
import restrictedAccessRoutes from './routes/restrictedAccess';
import reviewRoutes from './routes/reviews';

export function createExpressApp(): Express {
  const app = express();

  // Basic middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Global logger
  app.use(requestLogger);

  // Health check (public)
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Crown & Ledger Evidence Workspace API',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // Public safe client configuration (no server secrets)
  app.get('/api/config', (req, res) => {
    res.json({
      supabaseUrl: config.SUPABASE_URL,
      supabaseAnonKey: config.SUPABASE_ANON_KEY,
    });
  });

  // Global authentication middleware for all /api endpoints
  app.use('/api', authMiddleware);

  // Mount API modules
  app.use('/api/auth', authRoutes);
  app.use('/api/matters', matterRoutes);
  app.use('/api/cases', caseRoutes);
  app.use('/api/forensic-reports', forensicRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/documents', custodyRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/audit-logs', auditLogRoutes);
  app.use('/api/audit/logs', auditLogRoutes);
  app.use('/api/audit', auditLogRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/overview', statsRoutes);
  app.use('/api/restricted-access', restrictedAccessRoutes);
  app.use('/api/access-requests', restrictedAccessRoutes);

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
