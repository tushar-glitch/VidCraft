import { Router } from 'express';
import { createWebhookSchema } from '@vidcraft/shared';
import { parse } from '../../http/errors.ts';
import { requireUser } from '../auth/auth.middleware.ts';
import type { WebhooksService } from './webhooks.service.ts';

export function webhooksRoutes(webhooks: WebhooksService): Router {
  const router = Router();
  router.use(requireUser);

  router.get('/', async (req, res) => {
    res.json({ webhooks: await webhooks.list(req.userId!) });
  });

  router.post('/', async (req, res) => {
    const { url } = parse(createWebhookSchema, req.body);
    res.status(201).json({ webhook: await webhooks.create(req.userId!, url) });
  });

  router.delete('/:id', async (req, res) => {
    await webhooks.remove(req.userId!, req.params.id);
    res.status(204).end();
  });

  router.get('/:id/deliveries', async (req, res) => {
    res.json({ deliveries: await webhooks.deliveries(req.userId!, req.params.id) });
  });

  router.post('/:id/test', async (req, res) => {
    res.status(202).json({ delivery: await webhooks.test(req.userId!, req.params.id) });
  });

  router.post('/deliveries/:id/resend', async (req, res) => {
    res.status(202).json({ delivery: await webhooks.resend(req.userId!, req.params.id) });
  });

  return router;
}
