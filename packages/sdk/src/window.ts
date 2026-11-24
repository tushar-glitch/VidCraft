/**
 * Which videos should hold a player while `active` is on screen, most important first:
 * the current one, the next one (the likeliest swipe), then the previous one.
 * Only `poolSize` players exist, so a video outside this list has none.
 */
export function playerWindow(active: number, count: number, poolSize: number): number[] {
  const candidates = [active, active + 1, active - 1, active + 2, active - 2];
  return candidates.filter((i) => i >= 0 && i < count).slice(0, Math.max(1, poolSize));
}
