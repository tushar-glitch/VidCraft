import type { BenchRow } from '@vidcraft/shared';
import { TIMEOUT_MS } from './constants.ts';
import type { Sample } from './harness.ts';
import { median, summarize } from './stats.ts';

/** Everything measured in one browser session: one cold start, then a run of swipes. */
export interface SessionResult {
  cold: Sample;
  swipes: Sample[];
  /** Bytes of video downloaded during the session, including anything fetched ahead. */
  bytes: number;
}

/** Combines the sessions of one implementation on one network into the numbers the page shows. */
export function aggregate(network: string, impl: BenchRow['impl'], sessions: SessionResult[]): BenchRow {
  // A video that never played counts as the time limit, so failures drag the numbers down instead of vanishing.
  const startOf = (s: Sample) => s.startMs ?? TIMEOUT_MS;
  const swipeSamples = sessions.flatMap((s) => s.swipes);
  const allSamples = [...sessions.map((s) => s.cold), ...swipeSamples];
  const stalled = swipeSamples.filter((s) => s.stalls > 0);
  const qualities = allSamples.map((s) => s.quality).filter((q): q is number => q !== null);
  const views = sessions.reduce((n, s) => n + 1 + s.swipes.length, 0);
  const bytes = sessions.reduce((n, s) => n + s.bytes, 0);

  return {
    network,
    impl,
    cold: summarize(sessions.map((s) => startOf(s.cold))),
    swipe: summarize(swipeSamples.map(startOf)),
    stalledShare: swipeSamples.length ? stalled.length / swipeSamples.length : 0,
    stallMsMedian: stalled.length ? Math.round(median(stalled.map((s) => s.stallMs))) : null,
    timeouts: allSamples.filter((s) => s.startMs === null).length,
    megabytesPerView: Number((bytes / views / 1e6).toFixed(2)),
    qualityMedian: qualities.length ? Math.round(median(qualities)) : null,
  };
}
