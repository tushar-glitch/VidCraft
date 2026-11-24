import type { ConnectionBucket, PlaybackContext, PlaybackEvent, StartupBreakdown } from '@vidcraft/shared';
import type { Queryable } from '@vidcraft/shared/server';

// Every dashboard query is limited to events about the signed-in user's own videos, inside the time window.
const SCOPE = `from playback_events e
  join videos v on v.id = e.item_id
  where v.user_id = $1 and e.occurred_at >= now() - make_interval(days => $2::int)`;

const startup = `(e.data->>'startupMs')::float8`;

export interface OverviewRow {
  views: number;
  started: number;
  p50: number | null;
  p95: number | null;
  preloaded: number | null;
  rebufferedViews: number;
  watchMs: number;
  ended: number;
  completed: number;
}

export interface ConnectionRow {
  bucket: ConnectionBucket;
  views: number;
  p50: number | null;
  p95: number | null;
  rebufferRate: number | null;
}

export interface DailyRow {
  day: string;
  views: number;
  p50: number | null;
  p95: number | null;
}

/** A first-frame event joined with its video and context. */
export interface FirstFrameRow {
  viewId: string;
  itemId: string;
  title: string;
  at: Date;
  network: string | null;
  device: 'touch' | 'desktop';
  data: {
    startupMs: number;
    preloaded: boolean;
    quality: number | null;
    bandwidthKbps: number | null;
    breakdown: StartupBreakdown;
    fragmentBytes: number | null;
  };
}

export interface TraceEventRow {
  type: PlaybackEvent['type'];
  itemId: string;
  title: string;
  at: Date;
  network: string | null;
  device: 'touch' | 'desktop';
  data: Record<string, unknown>;
}

export class AnalyticsRepository {
  constructor(private readonly db: Queryable) {}

  async insert(context: PlaybackContext, events: { occurredAt: Date; event: PlaybackEvent }[]): Promise<void> {
    if (events.length === 0) return;
    const values: unknown[] = [];
    const rows = events.map(({ occurredAt, event }, i) => {
      const { type, itemId, viewId, t: _t, ...data } = event;
      values.push(occurredAt, type, itemId, viewId, context.sessionId, context.network, context.device, context.sdk, JSON.stringify(data));
      const n = i * 9;
      return `(${Array.from({ length: 9 }, (_, k) => `$${n + k + 1}`).join(', ')})`;
    });
    await this.db.query(
      `insert into playback_events (occurred_at, type, item_id, view_id, session_id, network, device, sdk, data)
       values ${rows.join(', ')}`,
      values,
    );
  }

  async overview(userId: string, days: number): Promise<OverviewRow> {
    const { rows } = await this.db.query<OverviewRow>(
      `select
         count(*) filter (where e.type = 'impression')::float8 as views,
         count(*) filter (where e.type = 'firstFrame')::float8 as started,
         percentile_cont(0.5) within group (order by ${startup}) filter (where e.type = 'firstFrame') as p50,
         percentile_cont(0.95) within group (order by ${startup}) filter (where e.type = 'firstFrame') as p95,
         (avg(((e.data->>'preloaded')::boolean)::int) filter (where e.type = 'firstFrame'))::float8 as preloaded,
         count(distinct e.view_id) filter (where e.type = 'rebuffer')::float8 as "rebufferedViews",
         coalesce(sum((e.data->>'watchTimeMs')::float8) filter (where e.type = 'viewEnd'), 0)::float8 as "watchMs",
         count(*) filter (where e.type = 'viewEnd')::float8 as ended,
         count(*) filter (where e.type = 'viewEnd' and (e.data->>'completed')::boolean)::float8 as completed
       ${SCOPE}`,
      [userId, days],
    );
    return rows[0]!;
  }

  /** Buckets by the player's own bandwidth measurement, which works in every browser (unlike the Network Information API). */
  async byConnection(userId: string, days: number): Promise<ConnectionRow[]> {
    const { rows } = await this.db.query<ConnectionRow>(
      `with started as (
         select e.view_id, ${startup} as startup, (e.data->>'bandwidthKbps')::float8 as bw
         ${SCOPE} and e.type = 'firstFrame'
       ), stalled as (
         select distinct e.view_id ${SCOPE} and e.type = 'rebuffer'
       )
       select
         case when s.bw is null then 'unknown' when s.bw < 1000 then 'slow' when s.bw < 5000 then 'medium' else 'fast' end as bucket,
         count(*)::float8 as views,
         percentile_cont(0.5) within group (order by s.startup) as p50,
         percentile_cont(0.95) within group (order by s.startup) as p95,
         (count(stalled.view_id)::float8 / count(*)) as "rebufferRate"
       from started s left join stalled using (view_id)
       group by 1`,
      [userId, days],
    );
    return rows;
  }

  async daily(userId: string, days: number): Promise<DailyRow[]> {
    const { rows } = await this.db.query<DailyRow>(
      `select
         to_char(date_trunc('day', e.occurred_at at time zone 'utc'), 'YYYY-MM-DD') as day,
         count(*) filter (where e.type = 'impression')::float8 as views,
         percentile_cont(0.5) within group (order by ${startup}) filter (where e.type = 'firstFrame') as p50,
         percentile_cont(0.95) within group (order by ${startup}) filter (where e.type = 'firstFrame') as p95
       ${SCOPE}
       group by 1 order by 1`,
      [userId, days],
    );
    return rows;
  }

  async slowest(userId: string, days: number, limit: number): Promise<FirstFrameRow[]> {
    const { rows } = await this.db.query<FirstFrameRow>(
      `select e.view_id as "viewId", e.item_id as "itemId", v.title, e.occurred_at as at, e.network, e.device, e.data
       ${SCOPE} and e.type = 'firstFrame'
       order by ${startup} desc
       limit $3`,
      [userId, days, limit],
    );
    return rows;
  }

  async trace(userId: string, viewId: string): Promise<TraceEventRow[]> {
    const { rows } = await this.db.query<TraceEventRow>(
      `select e.type, e.item_id as "itemId", v.title, e.occurred_at as at, e.network, e.device, e.data
       from playback_events e join videos v on v.id = e.item_id
       where v.user_id = $1 and e.view_id = $2
       order by e.occurred_at, e.id`,
      [userId, viewId],
    );
    return rows;
  }
}
