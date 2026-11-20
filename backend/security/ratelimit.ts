/**
 * In-memory fixed-window rate limiter with a hard cap on tracked keys (bounded memory).
 * Single-process by design (one container). For multiple replicas use a shared store.
 */
import type { Middleware, Req } from "./http-types.ts";

export interface RateLimitOptions {
  name: string;
  windowMs: number;
  max: number;
  keyFn?: (req: Req) => string;
  maxKeys?: number;
  now?: () => number;
  message?: string;
}

export function createRateLimiter(opts: RateLimitOptions): Middleware & { reset(): void; size(): number } {
  const now = opts.now ?? Date.now;
  const maxKeys = opts.maxKeys ?? 10_000;
  const hits = new Map<string, { count: number; resetAt: number }>();
  const keyFn = opts.keyFn ?? ((req: Req) => (req.auth?.userId ? `u:${req.auth.userId}` : `ip:${req.ip ?? "unknown"}`));

  function evictIfNeeded(t: number) {
    if (hits.size < maxKeys) return;
    for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    while (hits.size >= maxKeys) {
      const oldest = hits.keys().next().value;
      if (oldest === undefined) break;
      hits.delete(oldest);
    }
  }

  const mw: Middleware = (req, res, next) => {
    const t = now();
    const key = `${opts.name}:${keyFn(req)}`;
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      evictIfNeeded(t);
      entry = { count: 0, resetAt: t + opts.windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    const remaining = Math.max(0, opts.max - entry.count);
    const resetSec = Math.ceil((entry.resetAt - t) / 1000);
    res.setHeader("RateLimit-Limit", opts.max);
    res.setHeader("RateLimit-Remaining", remaining);
    res.setHeader("RateLimit-Reset", resetSec);
    if (entry.count > opts.max) {
      res.setHeader("Retry-After", resetSec);
      res.status(429).json({ error: opts.message ?? "Too many requests. Please slow down.", retryAfterSeconds: resetSec });
      return;
    }
    next();
  };
  return Object.assign(mw, { reset: () => hits.clear(), size: () => hits.size });
}
