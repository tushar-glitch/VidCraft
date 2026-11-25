/** Faster than this (px per ms) the viewer is flicking past. */
export const FLICK_PX_PER_MS = 1.5;

/**
 * Whether the video the scroll is passing over should start now.
 *
 * The next or previous video, relative to where the scroll began, is the expected destination and is
 * already loaded, so it starts as soon as it is half on screen: waiting for the scroll to settle
 * would add the whole swipe animation to every start. A video further away (a programmatic jump, a
 * dragged scrollbar) only starts once the viewer slows down or stops, so videos flicked past are never started.
 */
export function shouldStartNow(o: { target: number; gestureStart: number; settled: boolean; speedPxPerMs: number }): boolean {
  return o.settled || Math.abs(o.target - o.gestureStart) <= 1 || o.speedPxPerMs < FLICK_PX_PER_MS;
}

/**
 * Which videos should hold a player while `active` is on screen, most important first:
 * the current one, the next one (the likeliest swipe), then the previous one.
 * Only `poolSize` players exist, so a video outside this list has none.
 */
export function playerWindow(active: number, count: number, poolSize: number): number[] {
  const candidates = [active, active + 1, active - 1, active + 2, active - 2];
  return candidates.filter((i) => i >= 0 && i < count).slice(0, Math.max(1, poolSize));
}
