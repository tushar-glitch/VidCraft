import type { RequestHandler } from 'express';
import { HttpError } from './errors.ts';

/**
 * Allows `max` requests per `windowMs` from each IP address.
 * ponytail: counts live in this process's memory, so with several API instances each keeps its own;
 * move them to Redis or Postgres if that ever matters.
 */
export function rateLimit(opts: { windowMs: number; max: number; now?: () => number }): RequestHandler {
  const now = opts.now ?? Date.now;
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const t = now();
    if (hits.size > 10_000) for (const [key, h] of hits) if (h.resetAt <= t) hits.delete(key); // keep memory bounded

    const key = req.ip ?? 'unknown';
    let hit = hits.get(key);
    if (!hit || hit.resetAt <= t) {
      hit = { count: 0, resetAt: t + opts.windowMs };
      hits.set(key, hit);
    }
    if (++hit.count > opts.max) {
      res.set('Retry-After', String(Math.ceil((hit.resetAt - t) / 1000)));
      return next(new HttpError(429, 'rate_limited', 'Too many requests'));
    }
    next();
  };
}
