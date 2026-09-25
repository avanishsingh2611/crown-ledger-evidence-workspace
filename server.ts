/*
 * Crown & Ledger Evidence Workspace
 * Copyright © 2026 Avanish Singh
 * Author: Avanish Singh
 */

import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createExpressApp } from './server/app';
import { storageService } from './server/services/storageService';

const PORT = 3000;

async function startServer() {
  const app = createExpressApp();

  // Verify and ensure Supabase storage bucket asynchronously
  storageService
    .ensureBucket()
    .then(() => console.log('[Supabase Storage] Verified evidence-documents bucket'))
    .catch((err) => console.warn('[Supabase Storage] Initialization check note:', err));

  // Vite middleware for development / Static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Crown & Ledger Backend Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error during server startup:', err);
  process.exit(1);
});
