import { sendWebhook, type Logger, type WebhooksRepository } from '@vidcraft/shared/server';

export interface WebhookProcessorDeps {
  webhooks: WebhooksRepository;
  logger: Logger;
  /** Development only: allow webhooks to call localhost and private addresses. */
  allowPrivate: boolean;
}

/** Sends one queued webhook. A failure throws, so the queue retries it later with a longer wait. */
export function createWebhookProcessor({ webhooks, logger, allowPrivate }: WebhookProcessorDeps) {
  return async function processWebhook({ deliveryId, isLastAttempt }: { deliveryId: string; isLastAttempt: boolean }): Promise<void> {
    const log = logger.child({ deliveryId });
    const found = await webhooks.findDeliveryWithEndpoint(deliveryId);
    if (!found) return log.info('Delivery or endpoint was deleted; skipping');
    const { delivery, endpoint } = found;
    if (delivery.status === 'delivered') return log.info('Already delivered; skipping');

    const result = await sendWebhook({
      url: endpoint.url,
      secret: endpoint.secret,
      deliveryId: delivery.id,
      eventType: delivery.eventType,
      body: JSON.stringify(delivery.payload), // signed exactly as sent, so the receiver can verify it
      allowPrivate,
    });
    await webhooks.recordAttempt(delivery.id, { delivered: result.ok, status: result.status, error: result.error, final: isLastAttempt });

    if (result.ok) return log.info({ status: result.status }, 'Delivered');
    log.warn({ status: result.status, error: result.error, isLastAttempt }, 'Delivery failed');
    throw new Error(result.error ?? 'Webhook delivery failed');
  };
}
