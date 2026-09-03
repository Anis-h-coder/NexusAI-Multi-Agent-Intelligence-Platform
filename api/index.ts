import type { Request, Response } from 'express';
import app from '../server';

export default function handler(req: Request, res: Response) {
  // CORS headers for cross-origin or Vercel serverless invocations
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Restore rewritten req.url from Vercel headers so Express route matching succeeds
  const rawUrl = req.url || '';
  const forwardedUrl = (req.headers['x-forwarded-uri'] || req.headers['x-matched-path']) as string | undefined;

  if (forwardedUrl && (rawUrl === '/api/index' || rawUrl === '/api' || rawUrl.startsWith('/api/index?') || rawUrl.startsWith('/api?'))) {
    req.url = forwardedUrl;
  }

  return app(req, res);
}



