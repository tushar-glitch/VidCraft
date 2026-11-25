import type { WebhookEventType, WebhookPayload } from '../index.ts';
import type { Queryable } from './jobs.repository.ts';

export interface WebhookEndpoint {
  id: string;
  userId: string;
  url: string;
  secret: string;
  createdAt: Date;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventType: WebhookEventType;
  payload: WebhookPayload;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  lastStatus: number | null;
  lastError: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
}

interface EndpointRow {
  id: string;
  user_id: string;
  url: string;
  secret: string;
  created_at: Date;
}

interface DeliveryRow {
  id: string;
  endpoint_id: string;
  event_type: WebhookEventType;
  payload: WebhookPayload;
  status: WebhookDelivery['status'];
  attempts: number;
  last_status: number | null;
  last_error: string | null;
  created_at: Date;
  delivered_at: Date | null;
}

const toEndpoint = (r: EndpointRow): WebhookEndpoint => ({ id: r.id, userId: r.user_id, url: r.url, secret: r.secret, createdAt: r.created_at });
const toDelivery = (r: DeliveryRow): WebhookDelivery => ({
  id: r.id,
  endpointId: r.endpoint_id,
  eventType: r.event_type,
  payload: r.payload,
  status: r.status,
  attempts: r.attempts,
  lastStatus: r.last_status,
  lastError: r.last_error,
  createdAt: r.created_at,
  deliveredAt: r.delivered_at,
});

export class WebhooksRepository {
  constructor(private readonly db: Queryable) {}

  async createEndpoint(e: { userId: string; url: string; secret: string }): Promise<WebhookEndpoint> {
    const { rows } = await this.db.query<EndpointRow>('insert into webhook_endpoints (user_id, url, secret) values ($1, $2, $3) returning *', [e.userId, e.url, e.secret]);
    return toEndpoint(rows[0]!);
  }

  async listEndpoints(userId: string): Promise<WebhookEndpoint[]> {
    const { rows } = await this.db.query<EndpointRow>('select * from webhook_endpoints where user_id = $1 order by created_at', [userId]);
    return rows.map(toEndpoint);
  }

  /** Only finds the endpoint if it belongs to `userId`. */
  async findEndpoint(userId: string, id: string): Promise<WebhookEndpoint | null> {
    const { rows } = await this.db.query<EndpointRow>('select * from webhook_endpoints where id = $1 and user_id = $2', [id, userId]);
    return rows[0] ? toEndpoint(rows[0]) : null;
  }

  async deleteEndpoint(userId: string, id: string): Promise<boolean> {
    const { rowCount } = await this.db.query('delete from webhook_endpoints where id = $1 and user_id = $2', [id, userId]);
    return rowCount === 1;
  }

  async createDelivery(d: { id: string; endpointId: string; eventType: WebhookEventType; payload: WebhookPayload }): Promise<WebhookDelivery> {
    const { rows } = await this.db.query<DeliveryRow>(
      'insert into webhook_deliveries (id, endpoint_id, event_type, payload) values ($1, $2, $3, $4) returning *',
      [d.id, d.endpointId, d.eventType, JSON.stringify(d.payload)],
    );
    return toDelivery(rows[0]!);
  }

  /** A delivery with the endpoint it goes to, for the worker. Null if either has since been deleted. */
  async findDeliveryWithEndpoint(id: string): Promise<{ delivery: WebhookDelivery; endpoint: WebhookEndpoint } | null> {
    const { rows } = await this.db.query<DeliveryRow & { e_user_id: string; e_url: string; e_secret: string; e_created_at: Date }>(
      `select d.*, e.user_id as e_user_id, e.url as e_url, e.secret as e_secret, e.created_at as e_created_at
       from webhook_deliveries d join webhook_endpoints e on e.id = d.endpoint_id where d.id = $1`,
      [id],
    );
    const r = rows[0];
    if (!r) return null;
    return { delivery: toDelivery(r), endpoint: { id: r.endpoint_id, userId: r.e_user_id, url: r.e_url, secret: r.e_secret, createdAt: r.e_created_at } };
  }

  /** Only finds the delivery if its endpoint belongs to `userId`. */
  async findOwnedDelivery(userId: string, id: string): Promise<WebhookDelivery | null> {
    const { rows } = await this.db.query<DeliveryRow>(
      'select d.* from webhook_deliveries d join webhook_endpoints e on e.id = d.endpoint_id where d.id = $1 and e.user_id = $2',
      [id, userId],
    );
    return rows[0] ? toDelivery(rows[0]) : null;
  }

  async listDeliveries(endpointId: string, limit = 20): Promise<WebhookDelivery[]> {
    const { rows } = await this.db.query<DeliveryRow>('select * from webhook_deliveries where endpoint_id = $1 order by created_at desc limit $2', [endpointId, limit]);
    return rows.map(toDelivery);
  }

  /** Records one try. Delivered on success; failed once `final`; otherwise it stays pending for the retry. */
  async recordAttempt(id: string, r: { delivered: boolean; status: number | null; error: string | null; final: boolean }): Promise<void> {
    await this.db.query(
      `update webhook_deliveries set
         attempts = attempts + 1, last_status = $2, last_error = $3,
         status = case when $4 then 'delivered'::webhook_delivery_status when $5 then 'failed'::webhook_delivery_status else status end,
         delivered_at = case when $4 then now() else delivered_at end
       where id = $1`,
      [id, r.status, r.error, r.delivered, r.final],
    );
  }

  /** For "resend": back to pending with a clean slate, so it can be tried again. */
  async reset(id: string): Promise<void> {
    await this.db.query(`update webhook_deliveries set status = 'pending', attempts = 0, last_status = null, last_error = null, delivered_at = null where id = $1`, [id]);
  }
}
