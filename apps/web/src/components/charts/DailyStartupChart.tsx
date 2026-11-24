import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { AnalyticsOverviewDto } from '@vidcraft/shared';
import { formatMs } from '../../lib/format.ts';

type Day = AnalyticsOverviewDto['daily'][number];

const W = 720;
const H = 260;
const M = { top: 16, right: 68, bottom: 28, left: 52 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

const SERIES = [
  { key: 'startupP50Ms', name: 'Typical start (median)', short: 'Typical', color: 'var(--series-1)' },
  { key: 'startupP95Ms', name: 'Slowest 5% of starts', short: 'Slow tail', color: 'var(--series-2)' },
] as const;

/** Axis maximum and tick step rounded to clean numbers (0, 250, 500, 750, 1000). */
function niceScale(max: number): { step: number; ticks: number } {
  if (max <= 0) return { step: 25, ticks: 4 };
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough)!;
  return { step, ticks: Math.ceil(max / step) };
}

const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Daily start-up time: typical vs slow tail, on one axis. Days with no traffic are gaps, not zeros. */
export function DailyStartupChart({ daily }: { daily: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const titleId = useId();

  const values = daily.flatMap((d) => [d.startupP50Ms, d.startupP95Ms]).filter((v): v is number => v !== null);
  if (values.length === 0) {
    return <p className="rounded-md bg-gray-50 p-6 text-center text-sm text-gray-500">No playback data in this period yet. Watch a few videos in Explore and it will appear here.</p>;
  }

  const { step, ticks } = niceScale(Math.max(...values));
  const yMax = step * ticks;
  const n = daily.length;
  const x = (i: number) => M.left + (n === 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W);
  const y = (v: number) => M.top + PLOT_H - (v / yMax) * PLOT_H;

  /** Path pieces for consecutive days that have data; a missing day breaks the line. */
  const segments = (key: (typeof SERIES)[number]['key']) => {
    const out: string[] = [];
    let current: string[] = [];
    daily.forEach((d, i) => {
      const v = d[key];
      if (v === null) {
        if (current.length > 1) out.push(current.join(' '));
        current = [];
      } else current.push(`${current.length === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
    });
    if (current.length > 1) out.push(current.join(' '));
    return out;
  };

  // Points that no line reaches (a lone day between gaps) and each series' latest point get a marker.
  const marked = (key: (typeof SERIES)[number]['key']) => {
    const last = daily.findLastIndex((d) => d[key] !== null);
    return daily.flatMap((d, i) => {
      const v = d[key];
      const alone = v !== null && daily[i - 1]?.[key] == null && daily[i + 1]?.[key] == null;
      return v !== null && (alone || i === last) ? [{ i, v }] : [];
    });
  };

  // Direct labels ride the end of each line. If the two ends are too close to read apart, the legend and tooltip carry the names.
  const ends = SERIES.flatMap((s) => {
    const i = daily.findLastIndex((d) => d[s.key] !== null);
    return i < 0 ? [] : [{ s, i, v: daily[i]![s.key]! }];
  });
  const labelsFit = ends.length < 2 || Math.abs(y(ends[0]!.v) - y(ends[1]!.v)) >= 14;

  const pointerToIndex =(e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    return Math.min(n - 1, Math.max(0, Math.round(((px - M.left) / PLOT_W) * (n - 1))));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setHover((h) => Math.min(n - 1, Math.max(0, (h ?? n - 1) + (e.key === 'ArrowRight' ? 1 : -1))));
  };

  const labelEvery = Math.max(1, Math.ceil(n / 6)); // a handful of dates, not one per day
  const hovered = hover === null ? null : daily[hover];

  return (
    <div className="viz-root" style={{ color: 'var(--viz-ink)' }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" style={{ color: 'var(--viz-ink-2)' }}>
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
              {s.name}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setAsTable((t) => !t)} className="text-sm text-brand hover:underline">
          {asTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>

      {asTable ? (
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Daily start-up time</caption>
          <thead>
            <tr className="border-b text-xs uppercase" style={{ color: 'var(--viz-ink-2)' }}>
              <th className="py-1.5 font-medium">Day</th>
              <th className="py-1.5 font-medium">Typical</th>
              <th className="py-1.5 font-medium">Slowest 5%</th>
              <th className="py-1.5 font-medium">Views</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.day} className="border-b">
                <td className="py-1.5">{shortDay(d.day)}</td>
                <td className="py-1.5 tabular-nums">{d.startupP50Ms === null ? '—' : formatMs(d.startupP50Ms)}</td>
                <td className="py-1.5 tabular-nums">{d.startupP95Ms === null ? '—' : formatMs(d.startupP95Ms)}</td>
                <td className="py-1.5 tabular-nums">{d.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full touch-none rounded-md outline-offset-2"
            style={{ background: 'var(--viz-surface)' }}
            role="img"
            aria-labelledby={titleId}
            tabIndex={0}
            onPointerMove={(e) => setHover(pointerToIndex(e))}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover((h) => h ?? n - 1)}
            onBlur={() => setHover(null)}
            onKeyDown={onKey}
          >
            <title id={titleId}>Daily start-up time, typical and slowest 5%. Use the arrow keys to read each day.</title>
            {Array.from({ length: ticks + 1 }, (_, t) => (
              <g key={t}>
                <line x1={M.left} x2={W - M.right} y1={y(t * step)} y2={y(t * step)} style={{ stroke: t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)' }} strokeWidth={1} />
                <text x={M.left - 8} y={y(t * step)} textAnchor="end" dominantBaseline="middle" fontSize={11} style={{ fill: 'var(--viz-muted)' }}>
                  {t === 0 ? '0' : formatMs(t * step)}
                </text>
              </g>
            ))}
            {daily.map((d, i) =>
              i % labelEvery === 0 || i === n - 1 ? (
                <text key={d.day} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={11} style={{ fill: 'var(--viz-muted)' }}>
                  {shortDay(d.day)}
                </text>
              ) : null,
            )}

            {SERIES.map((s) => (
              <g key={s.key}>
                {segments(s.key).map((d, i) => (
                  <path key={i} d={d} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: s.color }} />
                ))}
                {marked(s.key).map(({ i, v }) => (
                  <circle key={i} cx={x(i)} cy={y(v)} r={4} strokeWidth={2} style={{ fill: s.color, stroke: 'var(--viz-surface)' }} />
                ))}
              </g>
            ))}

            {labelsFit &&
              ends.map(({ s, i, v }) => (
                <text key={s.key} x={x(i) + 9} y={y(v)} dominantBaseline="middle" fontSize={11} style={{ fill: 'var(--viz-ink-2)' }}>
                  {s.short}
                </text>
              ))}

            {hover !== null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + PLOT_H} style={{ stroke: 'var(--viz-axis)' }} strokeWidth={1} />
                {SERIES.map((s) => {
                  const v = daily[hover]?.[s.key];
                  return v == null ? null : <circle key={s.key} cx={x(hover)} cy={y(v)} r={4} strokeWidth={2} style={{ fill: s.color, stroke: 'var(--viz-surface)' }} />;
                })}
              </g>
            )}
          </svg>

          {hovered && hover !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-md border px-3 py-2 text-xs shadow-md"
              style={{
                left: `${(x(hover) / W) * 100}%`,
                transform: hover > n / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
                background: 'var(--viz-surface)',
                borderColor: 'var(--viz-border)',
                color: 'var(--viz-ink-2)',
              }}
            >
              <div className="mb-1 font-medium" style={{ color: 'var(--viz-ink)' }}>{shortDay(hovered.day)}</div>
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span aria-hidden className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
                  <b className="tabular-nums" style={{ color: 'var(--viz-ink)' }}>{hovered[s.key] === null ? '—' : formatMs(hovered[s.key]!)}</b>
                  <span>{s.name}</span>
                </div>
              ))}
              <div className="mt-1">{hovered.views} {hovered.views === 1 ? 'view' : 'views'}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
