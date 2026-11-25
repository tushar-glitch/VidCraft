import { randomUUID } from 'node:crypto';
import type { WebhookEventType, WebhookPayload } from '../index.ts';
import type { WebhookDelivery, WebhookEndpoint, WebhooksRepository } from './webhooks.repository.ts';

export const WEBHOOK_QUEUE = 'webhook.deliver';
export interface WebhookJobMessage {
  deliveryId: string;
}

/** Puts a message on a queue. The API and the worker each pass in their own pg-boss. */
export type SendToQueue = (queue: string, data: object) => Promise<unknown>;

/** Turns "something happened" into a stored delivery per endpoint plus a queued attempt to send it. */
export class WebhookEmitter {
  constructor(
    private readonly repo: WebhooksRepository,
    private readonly send: SendToQueue,
  ) {}

  /** Notify every endpoint the user has registered. Returns how many were notified. */
  async emit(userId: string, type: WebhookEventType, data: Record<string, unknown>): Promise<number> {
    const endpoints = await this.repo.listEndpoints(userId);
    await Promise.all(endpoints.map((e) => this.emitTo(e, type, data)));
    return endpoints.length;
  }

  async emitTo(endpoint: WebhookEndpoint, type: WebhookEventType, data: Record<string, unknown>): Promise<WebhookDelivery> {
    const id = randomUUID(); // doubles as the payload's id, which stays the same on every retry
    const payload: WebhookPayload = { id, type, createdAt: new Date().toISOString(), data };
    const delivery = await this.repo.createDelivery({ id, endpointId: endpoint.id, eventType: type, payload });
    await this.enqueue(delivery.id);
    return delivery;
  }

  enqueue(deliveryId: string): Promise<unknown> {
    return this.send(WEBHOOK_QUEUE, { deliveryId } satisfies WebhookJobMessage);
  }
}
