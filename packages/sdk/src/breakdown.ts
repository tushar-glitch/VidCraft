import type { StartupBreakdown } from './types.ts';

/** When each stage of loading a video finished, in `performance.now()` milliseconds. */
export interface LoadMarks {
  /** The player was pointed at the video and began loading. */
  assignedAt: number;
  manifestAt?: number;
  levelAt?: number;
  /** The first piece of video finished downloading. */
  fragAt?: number;
  fragBytes?: number;
}

/**
 * Splits the wait for the first frame into the stages that caused it.
 *
 * Only time the viewer actually waited counts: a stage that finished before the video became
 * current (because it was preloaded) contributes nothing, so a fully preloaded start shows up as
 * pure render time. Whatever is left after the network stages is attributed to decoding and
 * rendering, so the four parts always add up to the total.
 */
export function startupBreakdown(marks: LoadMarks, activatedAt: number, frameAt: number): StartupBreakdown {
  // How much of the stage [from, to] fell inside the viewer's wait [activatedAt, frameAt].
  const waited = (from?: number, to?: number) =>
    from === undefined || to === undefined ? 0 : Math.max(0, Math.min(to, frameAt) - Math.max(from, activatedAt));

  const manifestMs = Math.round(waited(marks.assignedAt, marks.manifestAt));
  const levelMs = Math.round(waited(marks.manifestAt, marks.levelAt));
  const fragmentMs = Math.round(waited(marks.levelAt, marks.fragAt));
  const total = Math.round(frameAt - activatedAt);
  return { manifestMs, levelMs, fragmentMs, renderMs: Math.max(0, total - manifestMs - levelMs - fragmentMs) };
}
