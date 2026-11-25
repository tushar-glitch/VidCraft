import { randomBytes } from 'node:crypto';
import { MAX_WEBHOOKS_PER_USER, type WebhookDeliveryDto, type WebhookEndpointDto } from '@vidcraft/shared';
import {
  assertWebhookUrl,
  WebhookUrlError,
  type WebhookDelivery,
  type WebhookEmitter,
  type WebhookEndpoint,
  type WebhooksRepository,
} from '@vidcraft/shared/server';
import { HttpError } from '../../http/errors.ts';

const toEndpointDto = (e: WebhookEndpoint, withSecret = false): WebhookEndpointDto => ({
  id: e.id,
  url: e.url,
  createdAt: e.createdAt.toISOString(),
  ...(withSecret && { secret: e.secret }),
});

const toDeliveryDto = (d: WebhookDelivery): WebhookDeliveryDto => ({
  id: d.id,
  eventType: d.eventType,
  status: d.status,
  attempts: d.attempts,
  lastStatus: d.lastStatus,
  lastError: d.lastError,
  createdAt: d.createdAt.toISOString(),
  deliveredAt: d.deliveredAt?.toISOString() ?? null,
});

const notFound = () => new HttpError(404, 'webhook_not_found', 'Webhook not found');

/** Manage where VidCraft sends event notifications. Every endpoint belongs to one user. */
export class WebhooksService {
  constructor(
    private readonly repo: WebhooksRepository,
    private readonly emitter: WebhookEmitter,
    /** Development only: allow localhost and private addresses. */
    private readonly allowPrivate: boolean,
  ) {}

  async create(userId: string, url: string): Promise<WebhookEndpointDto> {
    if ((await this.repo.listEndpoints(userId)).length >= MAX_WEBHOOKS_PER_USER) {
      throw new HttpError(409, 'too_many_webhooks', `You can have up to ${MAX_WEBHOOKS_PER_USER} webhooks`);
    }
    try {
      await assertWebhookUrl(url, this.allowPrivate);
    } catch (err) {
      if (err instanceof WebhookUrlError) throw new HttpError(400, 'invalid_webhook_url', err.message);
      throw err;
    }
    const secret = `whsec_${randomBytes(24).toString('base64url')}`;
    return toEndpointDto(await this.repo.createEndpoint({ userId, url, secret }), true);
  }

  async list(userId: string): Promise<WebhookEndpointDto[]> {
    return (await this.repo.listEndpoints(userId)).map((e) => toEndpointDto(e));
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.repo.deleteEndpoint(userId, id))) throw notFound();
  }

  async deliveries(userId: string, id: string): Promise<WebhookDeliveryDto[]> {
    const endpoint = await this.owned(userId, id);
    return (await this.repo.listDeliveries(endpoint.id)).map(toDeliveryDto);
  }

  /** Sends a `ping` event to this endpoint only, so its owner can check it works. */
  async test(userId: string, id: string): Promise<WebhookDeliveryDto> {
    const endpoint = await this.owned(userId, id);
    return toDeliveryDto(await this.emitter.emitTo(endpoint, 'ping', { message: 'This is a test event from VidCraft.' }));
  }

  /** Tries a delivery again from scratch, for when the receiver was down. */
  async resend(userId: string, deliveryId: string): Promise<WebhookDeliveryDto> {
    const delivery = /^[0-9a-f-]{36}$/i.test(deliveryId) ? await this.repo.findOwnedDelivery(userId, deliveryId) : null;
    if (!delivery) throw notFound();
    await this.repo.reset(delivery.id);
    await this.emitter.enqueue(delivery.id);
    return toDeliveryDto({ ...delivery, status: 'pending', attempts: 0, lastStatus: null, lastError: null, deliveredAt: null });
  }

  private async owned(userId: string, id: string): Promise<WebhookEndpoint> {
    const endpoint = /^[0-9a-f-]{36}$/i.test(id) ? await this.repo.findEndpoint(userId, id) : null;
    if (!endpoint) throw notFound();
    return endpoint;
  }
}
