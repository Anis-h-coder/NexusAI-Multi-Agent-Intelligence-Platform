import type { Request, Response } from 'express';
import app from '../server.js';

export default function handler(req: Request, res: Response) {
  // Normalize Vercel rewritten URL from x-forwarded-uri header if present
  const forwardedUrl = (req.headers['x-forwarded-uri'] || req.headers['x-matched-path']) as string | undefined;
  if (forwardedUrl && (req.url === '/api/index' || req.url === '/api' || req.url.startsWith('/api/index?'))) {
    req.url = forwardedUrl;
  }
  return app(req, res);
}

