import { Router } from 'express';
import { createJobRequestSchema } from '@vidcraft/shared';
import { parse } from '../../http/errors.ts';
import { requireUser } from '../auth/auth.middleware.ts';
import type { JobsService } from './jobs.service.ts';

export function jobsRoutes(jobs: JobsService): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    res.status(201).json(await jobs.create(req.userId, parse(createJobRequestSchema, req.body)));
  });

  router.post('/:id/start', async (req, res) => {
    res.json({ job: await jobs.start(req.userId, req.params.id) });
  });

  router.get('/', requireUser, async (req, res) => {
    res.json({ jobs: await jobs.listForUser(req.userId!) });
  });

  router.get('/:id', async (req, res) => {
    res.json({ job: await jobs.get(req.userId, req.params.id) });
  });

  return router;
}
