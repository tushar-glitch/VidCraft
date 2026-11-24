import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { connectionBucket, type AnalyticsOverviewDto, type ConnectionBucket, type SlowViewDto, type ViewTraceDto } from '@vidcraft/shared';
import { DailyStartupChart } from '../../components/charts/DailyStartupChart.tsx';
import { STAGES, StageBar, StageLegend } from '../../components/charts/StageBar.tsx';
import { StatTile } from '../../components/charts/StatTile.tsx';
import { api, ApiError } from '../../lib/api.ts';
import { formatBytes, formatDate, formatKbps, formatMs, formatPercent, formatWatchTime } from '../../lib/format.ts';
import { Panel } from './DashboardLayout.tsx';

const PRESETS = [7, 30, 90] as const;

const BUCKET: Record<ConnectionBucket, { name: string; hint: string }> = {
  slow: { name: 'Slow', hint: 'under 1 Mbit/s' },
  medium: { name: 'Medium', hint: '1 to 5 Mbit/s' },
  fast: { name: 'Fast', hint: 'over 5 Mbit/s' },
  unknown: { name: 'Not measured', hint: 'nothing downloaded yet' },
};

const orDash = (v: number | null, fmt: (n: number) => string) => (v === null ? '—' : fmt(v));

export function Analytics() {
  const [days, setDays] = useState<(typeof PRESETS)[number]>(7);
  const [data, setData] = useState<{ overview: AnalyticsOverviewDto; slowest: SlowViewDto[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.analyticsOverview(days), api.slowestViews(days, 10)])
      .then(([overview, slowest]) => !cancelled && setData({ overview, slowest }))
      .catch(() => !cancelled && setError('Could not load analytics. Please refresh.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const o = data?.overview;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Playback analytics</h1>
        <p className="mt-1 text-sm text-gray-600">
          How fast your videos start and how smoothly they play. Only plays of your own videos are counted.
        </p>
      </header>

      {/* One filter row, above everything it scopes. */}
      <div role="group" aria-label="Time range" className="flex gap-2">
        {PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={days === d}
            onClick={() => setDays(d)}
            className={`rounded-md border px-3 py-1.5 text-sm ${days === d ? 'border-brand bg-blue-50 font-medium text-brand' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            Last {d} days
          </button>
        ))}
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="text-gray-500">Loading…</p>}

      {/* On a refetch, keep the previous numbers on screen, dimmed, instead of flashing a skeleton. */}
      {o && (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {o.views === 0 ? (
            <Panel title="No plays yet">
              <p className="text-gray-600">
                When someone watches your published videos, the numbers show up here. Try it yourself in{' '}
                <Link to="/explore" className="text-brand underline">Explore</Link>.
              </p>
            </Panel>
          ) : (
            <>
              <section aria-label="Key numbers" className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatTile label="Views" value={o.views.toLocaleString()} note={`${o.started.toLocaleString()} reached a first frame`} />
                <StatTile label="Watch time" value={formatWatchTime(o.watchTimeMs)} />
                <StatTile label="Completion rate" value={orDash(o.completionRate, formatPercent)} note="reached 95% of the video" />
                <StatTile label="Views that stalled" value={orDash(o.rebufferRate, formatPercent)} note="paused to load at least once" />
                <StatTile label="Typical start" value={orDash(o.startupP50Ms, formatMs)} note="median time to first frame" />
                <StatTile label="Slow tail" value={orDash(o.startupP95Ms, formatMs)} note="1 start in 20 is slower than this" />
                <StatTile label="Started from preload" value={orDash(o.preloadedShare, formatPercent)} note="already loaded before the swipe" />
              </section>

              <Panel title="Start-up time by day">
                <DailyStartupChart daily={o.daily} />
              </Panel>

              <Panel title="By connection speed">
                <p className="mb-3 text-sm text-gray-600">Speed is what the viewer's player measured while loading, so it works in every browser.</p>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs text-gray-600 uppercase">
                      <th className="py-2 font-medium">Connection</th>
                      <th className="py-2 font-medium">Starts</th>
                      <th className="py-2 font-medium">Typical start</th>
                      <th className="py-2 font-medium">Slow tail</th>
                      <th className="py-2 font-medium">Stalled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.byConnection.map((r) => (
                      <tr key={r.bucket} className="border-b">
                        <td className="py-2">
                          {BUCKET[r.bucket].name} <span className="text-xs text-gray-500">{BUCKET[r.bucket].hint}</span>
                        </td>
                        <td className="py-2 tabular-nums">{r.views.toLocaleString()}</td>
                        <td className="py-2 tabular-nums">{orDash(r.startupP50Ms, formatMs)}</td>
                        <td className="py-2 tabular-nums">{orDash(r.startupP95Ms, formatMs)}</td>
                        <td className="py-2 tabular-nums">{orDash(r.rebufferRate, formatPercent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>

              <Panel title="Slowest starts">
                <p className="mb-3 text-sm text-gray-600">
                  Each bar splits one start-up into the stages the viewer waited through. Select a row to trace that play.
                </p>
                <StageLegend />
                <SlowStarts views={data.slowest} />
              </Panel>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SlowStarts({ views }: { views: SlowViewDto[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (views.length === 0) return <p className="text-sm text-gray-500">No starts recorded in this period.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs text-gray-600 uppercase">
            <th className="py-2 pr-3 font-medium">Video</th>
            <th className="py-2 pr-3 font-medium">Start-up</th>
            <th className="w-1/3 py-2 pr-3 font-medium">Where the time went</th>
            <th className="py-2 pr-3 font-medium">Connection</th>
            <th className="py-2 font-medium"><span className="sr-only">Trace</span></th>
          </tr>
        </thead>
        <tbody>
          {views.map((v) => {
            const open = openId === v.viewId;
            return (
              <Fragment key={v.viewId}>
                <tr className="border-b align-middle">
                  <td className="max-w-48 py-2 pr-3">
                    <div className="truncate font-medium text-gray-800">{v.title}</div>
                    <div className="text-xs text-gray-500">{formatDate(v.at)}</div>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
                    <b>{formatMs(v.startupMs)}</b>
                    <div className="text-xs text-gray-500">{v.preloaded ? 'preloaded' : 'cold start'}</div>
                  </td>
                  <td className="py-2 pr-3"><StageBar breakdown={v.breakdown} /></td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {BUCKET[connectionBucket(v.bandwidthKbps)].name}
                    <div className="text-xs text-gray-500">{v.bandwidthKbps === null ? (v.network ?? '') : formatKbps(v.bandwidthKbps)}</div>
                  </td>
                  <td className="py-2 text-right">
                    <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : v.viewId)} className="text-brand hover:underline">
                      {open ? 'Hide trace' : 'Trace'}
                    </button>
                  </td>
                </tr>
                {open && (
                  <tr className="border-b bg-gray-50">
                    <td colSpan={5} className="p-4"><Trace viewId={v.viewId} /></td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Everything that happened during one play of one video. */
function Trace({ viewId }: { viewId: string }) {
  const [trace, setTrace] = useState<ViewTraceDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.viewTrace(viewId).then(setTrace, (err) => setError(err instanceof ApiError && err.status === 404 ? 'This play is no longer available.' : 'Could not load the trace.'));
  }, [viewId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!trace) return <p className="text-sm text-gray-500">Loading trace…</p>;
  const s = trace.startup;

  return (
    <div className="grid gap-6 text-sm md:grid-cols-2">
      <div>
        <h3 className="mb-2 font-medium">Start-up, stage by stage</h3>
        {s ? (
          <ul className="viz-root space-y-1.5">
            {STAGES.map((stage) => (
              <li key={stage.key} className="flex items-center gap-2">
                <span aria-hidden className="inline-block h-2 w-3 rounded-sm" style={{ background: stage.color }} />
                <span className="flex-1">{stage.name}</span>
                <b className="tabular-nums">{formatMs(s.breakdown[stage.key])}</b>
              </li>
            ))}
            <li className="flex items-center gap-2 border-t pt-1.5">
              <span className="inline-block w-3" />
              <span className="flex-1">Total</span>
              <b className="tabular-nums">{formatMs(s.startupMs)}</b>
            </li>
          </ul>
        ) : (
          <p className="text-gray-600">This play never reached a first frame.</p>
        )}
        {s?.preloaded && (
          <p className="mt-2 text-xs text-gray-500">Downloading finished before the viewer arrived, so only decoding and drawing counted.</p>
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        <dt className="text-gray-500">Quality</dt>
        <dd>{s?.quality ? `${s.quality}p` : '—'}{trace.qualityChanges.length > 0 && ` · switched ${trace.qualityChanges.map((c) => `${c.from ?? '?'}p → ${c.to}p`).join(', ')}`}</dd>
        <dt className="text-gray-500">Measured speed</dt>
        <dd>{s?.bandwidthKbps ? formatKbps(s.bandwidthKbps) : 'not measured'}{trace.network && ` (browser says ${trace.network})`}</dd>
        <dt className="text-gray-500">First chunk</dt>
        <dd>{s?.fragmentBytes ? formatBytes(s.fragmentBytes) : '—'}</dd>
        <dt className="text-gray-500">Stalls</dt>
        <dd>{trace.rebuffers.length === 0 ? 'none' : `${trace.rebuffers.length} (${formatMs(trace.rebuffers.reduce((a, b) => a + b, 0))} in total)`}</dd>
        <dt className="text-gray-500">Watched</dt>
        <dd>{trace.watchTimeMs === null ? 'still watching, or left without a report' : `${formatWatchTime(trace.watchTimeMs)}${trace.completed ? ' · finished' : ''}`}</dd>
        <dt className="text-gray-500">Device</dt>
        <dd>{trace.device === 'touch' ? 'Touch screen' : 'Desktop'}</dd>
        {trace.errors.length > 0 && (
          <>
            <dt className="text-gray-500">Errors</dt>
            <dd className="text-red-700">{trace.errors.join('; ')}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
