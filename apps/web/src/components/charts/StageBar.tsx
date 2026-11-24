import { useState } from 'react';
import type { StartupBreakdown } from '@vidcraft/shared';
import { formatMs, formatPercent } from '../../lib/format.ts';

/** The four stages in the order they happen. Each keeps its own colour everywhere. */
export const STAGES = [
  { key: 'manifestMs', name: 'Fetching playlist', color: 'var(--series-1)' },
  { key: 'levelMs', name: 'Fetching quality playlist', color: 'var(--series-2)' },
  { key: 'fragmentMs', name: 'Downloading first chunk', color: 'var(--series-3)' },
  { key: 'renderMs', name: 'Decoding and drawing', color: 'var(--series-4)' },
] as const satisfies readonly { key: keyof StartupBreakdown; name: string; color: string }[];

/** One legend for a whole table of bars: the bars carry no text, the figures sit beside them. */
export function StageLegend() {
  return (
    <ul className="viz-root mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm" style={{ color: 'var(--viz-ink-2)' }}>
      {STAGES.map((s) => (
        <li key={s.key} className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-2 w-4 rounded-sm" style={{ background: s.color }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/** A thin segmented bar: how a start-up time divides between the stages. Hover or focus a part for its figure. */
export function StageBar({ breakdown }: { breakdown: StartupBreakdown }) {
  const [active, setActive] = useState<number | null>(null);
  const total = STAGES.reduce((sum, s) => sum + breakdown[s.key], 0);
  // A stage that took no time draws nothing.
  const parts = STAGES.map((s, i) => ({ ...s, ms: breakdown[s.key], i })).filter((p) => p.ms > 0);
  const label = `Start-up breakdown: ${STAGES.map((s) => `${s.name} ${formatMs(breakdown[s.key])}`).join(', ')}`;
  if (total === 0) return <span className="text-xs text-gray-400">—</span>;

  return (
    <div className="viz-root relative" role="group" aria-label={label}>
      {/* The 24px row is the hit target; the painted bar inside it is 8px. */}
      <div className="flex items-center" style={{ gap: 2 }}>
        {parts.map((p, k) => (
          <div
            key={p.key}
            tabIndex={0}
            className="flex h-6 items-center outline-offset-1"
            style={{ flex: `${p.ms} 1 0`, minWidth: 6 }}
            onPointerEnter={() => setActive(p.i)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(p.i)}
            onBlur={() => setActive(null)}
          >
            <div
              className="w-full transition-opacity"
              style={{
                height: 8,
                background: p.color,
                opacity: active === null || active === p.i ? 1 : 0.55,
                borderRadius: `${k === 0 ? 4 : 0}px ${k === parts.length - 1 ? 4 : 0}px ${k === parts.length - 1 ? 4 : 0}px ${k === 0 ? 4 : 0}px`,
              }}
            />
          </div>
        ))}
      </div>
      {active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
          style={{ background: 'var(--viz-surface)', borderColor: 'var(--viz-border)', color: 'var(--viz-ink-2)' }}
        >
          <span aria-hidden className="inline-block h-2 w-3 rounded-sm" style={{ background: STAGES[active]!.color }} />
          <b className="tabular-nums" style={{ color: 'var(--viz-ink)' }}>{formatMs(breakdown[STAGES[active]!.key])}</b>
          <span>{STAGES[active]!.name} ({formatPercent(breakdown[STAGES[active]!.key] / total)})</span>
        </div>
      )}
    </div>
  );
}
