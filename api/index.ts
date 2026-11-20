import type { Request, Response } from 'express';
import app from '../server';

/**
 * Legacy Vercel serverless entry (kept temporarily; see docs/PHASE2_SECURITY.md).
 *
 * CORS is enforced by the Express app itself (strict ALLOWED_ORIGINS allowlist). This handler must NOT add
 * wildcard CORS headers: `Access-Control-Allow-Origin: *` combined with credentials is unsafe.
 *
 * LIMITATION: serverless functions have an ephemeral filesystem. Accounts and sessions are stored in SQLite under
 * DATA_DIR (defaults to /tmp on Vercel), so they are lost on cold starts and are not shared between instances.
 * Use the Docker deployment for any real multi-user workload.
 */
export default function handler(req: Request, res: Response) {
  // Restore rewritten req.url from Vercel headers so Express route matching succeeds
  const rawUrl = req.url || '';
  const forwardedUrl = (req.headers['x-forwarded-uri'] || req.headers['x-matched-path']) as string | undefined;

  if (forwardedUrl && (rawUrl === '/api/index' || rawUrl === '/api' || rawUrl.startsWith('/api/index?') || rawUrl.startsWith('/api?'))) {
    req.url = forwardedUrl;
  }

  return app(req, res);
}
