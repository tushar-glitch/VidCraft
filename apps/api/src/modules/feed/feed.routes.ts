import cors from 'cors';
import { Router } from 'express';
import { feedQuerySchema } from '@vidcraft/shared';
import { parse } from '../../http/errors.ts';
import type { FeedService } from './feed.service.ts';

/** Public and cookie-free, so any website may call it from the browser. */
export function feedRoutes(feed: FeedService): Router {
  const router = Router();
  router.use(cors({ origin: '*' }));

  router.get('/', async (req, res) => {
    const { limit, cursor } = parse(feedQuerySchema, req.query);
    res.set('Cache-Control', 'public, max-age=5'); // new publishes show up within seconds
    res.json(await feed.page(limit, cursor));
  });

  return router;
}
