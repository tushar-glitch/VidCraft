import { Router } from 'express';
import { createVideoRequestSchema, updateVideoSchema } from '@vidcraft/shared';
import { parse } from '../../http/errors.ts';
import { requireUser } from '../auth/auth.middleware.ts';
import type { VideosService } from './videos.service.ts';

export function videosRoutes(videos: VideosService): Router {
  const router = Router();
  router.use(requireUser);

  router.post('/', async (req, res) => {
    res.status(201).json(await videos.create(req.userId!, parse(createVideoRequestSchema, req.body)));
  });

  router.get('/', async (req, res) => {
    res.json({ videos: await videos.list(req.userId!) });
  });

  router.get('/:id', async (req, res) => {
    res.json({ video: await videos.get(req.userId!, req.params.id) });
  });

  router.post('/:id/start', async (req, res) => {
    res.json({ video: await videos.start(req.userId!, req.params.id) });
  });

  router.patch('/:id', async (req, res) => {
    res.json({ video: await videos.update(req.userId!, req.params.id, parse(updateVideoSchema, req.body)) });
  });

  router.delete('/:id', async (req, res) => {
    await videos.remove(req.userId!, req.params.id);
    res.status(204).end();
  });

  return router;
}
