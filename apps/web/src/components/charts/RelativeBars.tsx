import { useId, useState } from 'react';

export interface RelativeBar {
  key: string;
  label: string;
  /** Small text under the label, e.g. the two absolute numbers. */
  detail: string;
  /** This value as a share of the baseline's: 1 means the same. */
  ratio: number;
  /** Lines shown in the tooltip. */
  tip: string[];
}

const W = 720;
const LABEL_W = 210;
const PLOT = { left: LABEL_W + 16, right: W - 44 };
const PLOT_W = PLOT.right - PLOT.left;
const ROW_H = 58;
const TOP = 28;
const BAR_H = 20; // bars are never thicker than 24px

/**
 * Horizontal bars on one shared axis, where 100% is "same as the baseline". Indexing to a common base keeps
 * everything on a single scale even when the absolute numbers differ by orders of magnitude.
 */
export function RelativeBars({ bars, title }: { bars: RelativeBar[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const maxPct = Math.max(...bars.map((b) => b.ratio * 100), 100);
  const axisMax = Math.max(125, Math.ceil(maxPct / 25) * 25);
  const ticks = Array.from({ length: axisMax / 25 + 1 }, (_, i) => i * 25);
  const H = TOP + bars.length * ROW_H + 28;
  const x = (pct: number) => PLOT.left + (pct / axisMax) * PLOT_W;

  /** Square at the baseline, 4px rounded at the data end. */
  const barPath = (x0: number, y: number, w: number) => {
    const r = Math.min(4, w / 2);
    return `M${x0} ${y} h${w - r} a${r} ${r} 0 0 1 ${r} ${r} v${BAR_H - 2 * r} a${r} ${r} 0 0 1 ${-r} ${r} h${-(w - r)} z`;
  };

  return (
    <div className="viz-root relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full rounded-md" style={{ background: 'var(--viz-surface)' }} role="img" aria-labelledby={titleId}>
        <title id={titleId}>{title}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={TOP - 6} y2={TOP + bars.length * ROW_H} style={{ stroke: t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)' }} strokeWidth={1} />
            <text x={x(t)} y={TOP + bars.length * ROW_H + 18} textAnchor="middle" fontSize={11} style={{ fill: 'var(--viz-muted)' }}>{t}%</text>
          </g>
        ))}
        <line x1={x(100)} x2={x(100)} y1={TOP - 6} y2={TOP + bars.length * ROW_H} strokeWidth={1.5} style={{ stroke: 'var(--viz-ink-2)' }} />
        <text x={x(100)} y={TOP - 12} textAnchor="middle" fontSize={11} style={{ fill: 'var(--viz-ink-2)' }}>same as baseline</text>

        {bars.map((b, i) => {
          const y = TOP + i * ROW_H;
          const w = Math.max(2, x(b.ratio * 100) - PLOT.left);
          return (
            <g
              key={b.key}
              tabIndex={0}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="outline-offset-[-2px]"
            >
              {/* the whole row is the hit target, not just the thin bar */}
              <rect x={0} y={y} width={W} height={ROW_H} fill="transparent" />
              <text x={0} y={y + ROW_H / 2 - 4} fontSize={13} fontWeight={500} style={{ fill: 'var(--viz-ink)' }}>{b.label}</text>
              <text x={0} y={y + ROW_H / 2 + 13} fontSize={11} style={{ fill: 'var(--viz-ink-2)' }}>{b.detail}</text>
              <path d={barPath(PLOT.left, y + (ROW_H - BAR_H) / 2, w)} style={{ fill: 'var(--series-1)', opacity: active === null || active === i ? 1 : 0.55 }} />
              <text x={PLOT.left + w + 8} y={y + ROW_H / 2} dominantBaseline="middle" fontSize={13} fontWeight={600} style={{ fill: 'var(--viz-ink)' }}>
                {Math.round(b.ratio * 100)}%
              </text>
            </g>
          );
        })}
      </svg>

      {active !== null && bars[active] && (
        <div
          role="status"
          className="pointer-events-none absolute right-2 z-10 rounded-md border px-3 py-2 text-xs shadow-md"
          style={{
            // Above the hovered row (or below it, for the first), so the bar and its value stay visible.
            top: `${((TOP + (active === 0 ? active + 1 : active) * ROW_H) / H) * 100}%`,
            transform: active === 0 ? undefined : 'translateY(-100%)',
            background: 'var(--viz-surface)',
            borderColor: 'var(--viz-border)',
            color: 'var(--viz-ink-2)',
          }}
        >
          <div className="mb-1 font-medium" style={{ color: 'var(--viz-ink)' }}>{bars[active]!.label}</div>
          {bars[active]!.tip.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
