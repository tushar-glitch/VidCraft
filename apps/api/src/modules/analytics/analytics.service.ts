import type { AnalyticsOverviewDto, ConnectionBucket, SlowViewDto, StartupDto, ViewTraceDto } from '@vidcraft/shared';
import { HttpError } from '../../http/errors.ts';
import type { AnalyticsRepository, FirstFrameRow } from './analytics.repository.ts';

const BUCKET_ORDER: ConnectionBucket[] = ['slow', 'medium', 'fast', 'unknown'];
const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);
const round = (n: number | null) => (n === null ? null : Math.round(n));

const toStartup = (d: FirstFrameRow['data']): StartupDto => ({
  startupMs: d.startupMs,
  preloaded: d.preloaded,
  quality: d.quality,
  bandwidthKbps: d.bandwidthKbps,
  breakdown: d.breakdown,
  fragmentBytes: d.fragmentBytes,
});

/** Turns raw event queries into what the dashboard shows. */
export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository) {}

  async overview(userId: string, days: number, now = new Date()): Promise<AnalyticsOverviewDto> {
    const [o, byConnection, daily] = await Promise.all([
      this.repo.overview(userId, days),
      this.repo.byConnection(userId, days),
      this.repo.daily(userId, days),
    ]);

    // Days with no traffic must appear as gaps in the chart, not be silently skipped.
    const byDay = new Map(daily.map((d) => [d.day, d]));
    const series = Array.from({ length: days }, (_, i) => {
      const day = new Date(now.getTime() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
      const row = byDay.get(day);
      return { day, views: row?.views ?? 0, startupP50Ms: round(row?.p50 ?? null), startupP95Ms: round(row?.p95 ?? null) };
    });

    return {
      days,
      views: o.views,
      started: o.started,
      watchTimeMs: Math.round(o.watchMs),
      completionRate: ratio(o.completed, o.ended),
      startupP50Ms: round(o.p50),
      startupP95Ms: round(o.p95),
      preloadedShare: o.preloaded,
      rebufferRate: ratio(o.rebufferedViews, o.started),
      byConnection: byConnection
        .map((r) => ({ bucket: r.bucket, views: r.views, startupP50Ms: round(r.p50), startupP95Ms: round(r.p95), rebufferRate: r.rebufferRate }))
        .sort((a, b) => BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket)),
      daily: series,
    };
  }

  async slowest(userId: string, days: number, limit: number): Promise<SlowViewDto[]> {
    return (await this.repo.slowest(userId, days, limit)).map((r) => ({
      viewId: r.viewId,
      itemId: r.itemId,
      title: r.title,
      at: r.at.toISOString(),
      network: r.network,
      device: r.device,
      ...toStartup(r.data),
    }));
  }

  /** Everything that happened during one play of one video. */
  async trace(userId: string, viewId: string): Promise<ViewTraceDto> {
    const events = await this.repo.trace(userId, viewId);
    const first = events[0];
    if (!first) throw new HttpError(404, 'view_not_found', 'View not found');

    const trace: ViewTraceDto = {
      viewId,
      itemId: first.itemId,
      title: first.title,
      startedAt: first.at.toISOString(),
      network: first.network,
      device: first.device,
      startup: null,
      rebuffers: [],
      qualityChanges: [],
      errors: [],
      watchTimeMs: null,
      completed: null,
    };
    for (const e of events) {
      const d = e.data as Record<string, any>;
      if (e.type === 'firstFrame') trace.startup = toStartup(d as FirstFrameRow['data']);
      else if (e.type === 'rebuffer') trace.rebuffers.push(d.durationMs);
      else if (e.type === 'qualityChange') trace.qualityChanges.push({ from: d.from, to: d.to });
      else if (e.type === 'error') trace.errors.push(d.message);
      else if (e.type === 'viewEnd') {
        trace.watchTimeMs = d.watchTimeMs;
        trace.completed = d.completed;
      }
    }
    return trace;
  }
}
