import cors from 'cors';
import express, { Router } from 'express';
import { analyticsQuerySchema, playbackBatchSchema, playbackEventSchema } from '@vidcraft/shared';
import { HttpError, parse } from '../../http/errors.ts';
import { rateLimit } from '../../http/rate-limit.ts';
import { requireUser } from '../auth/auth.middleware.ts';
import type { AnalyticsRepository } from './analytics.repository.ts';
import type { AnalyticsService } from './analytics.service.ts';

const DAY_MS = 86_400_000;

/** Trust the viewer's clock only if it is plausible; otherwise use ours. */
export function clampTime(t: number, now: Date): Date {
  return t >= now.getTime() - DAY_MS && t <= now.getTime() + 5 * 60_000 ? new Date(t) : now;
}

/**
 * Public ingest for the SDK. No cookies and any origin may call it, so it is rate limited
 * and every event is validated and size-capped.
 */
export function eventsRoutes(repo: Pick<AnalyticsRepository, 'insert'>, now: () => Date = () => new Date()): Router {
  const router = Router();
  router.use(cors({ origin: '*' }));
  router.use(rateLimit({ windowMs: 60_000, max: 120 }));
  // The SDK sends text/plain: that is a "simple" request, so browsers skip the CORS preflight,
  // and navigator.sendBeacon (used when the page closes) can send it.
  router.use(express.text({ type: () => true, limit: '100kb' }));

  router.post('/', async (req, res) => {
    let body: unknown;
    try {
      body = JSON.parse(req.body);
    } catch {
      throw new HttpError(400, 'invalid_json', 'Body must be JSON');
    }
    const batch = parse(playbackBatchSchema, body);
    const received = now();

    const accepted = [];
    let rejected = 0;
    for (const raw of batch.events) {
      const result = playbackEventSchema.safeParse(raw);
      if (result.success) accepted.push({ occurredAt: clampTime(result.data.t, received), event: result.data });
      else rejected++;
    }
    await repo.insert(batch.context, accepted);
    res.status(202).json({ accepted: accepted.length, rejected });
  });

  return router;
}

/** The dashboard's data. Signed-in only, and only about the user's own videos. */
export function analyticsRoutes(analytics: AnalyticsService): Router {
  const router = Router();
  router.use(requireUser);

  router.get('/overview', async (req, res) => {
    const { days } = parse(analyticsQuerySchema, req.query);
    res.json(await analytics.overview(req.userId!, days));
  });

  router.get('/slowest', async (req, res) => {
    const { days, limit } = parse(analyticsQuerySchema, req.query);
    res.json({ views: await analytics.slowest(req.userId!, days, limit) });
  });

  router.get('/views/:viewId', async (req, res) => {
    const viewId = req.params.viewId;
    if (viewId.length < 8 || viewId.length > 64) throw new HttpError(404, 'view_not_found', 'View not found');
    res.json({ view: await analytics.trace(req.userId!, viewId) });
  });

  return router;
}
