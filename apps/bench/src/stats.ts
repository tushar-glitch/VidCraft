import type { BenchSummary } from '@vidcraft/shared';

/** Nearest-rank percentile: the smallest value that at least p% of the data is at or below. `p` is 0-100. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) throw new Error('percentile of nothing');
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1]!;
}

/** Median of the data; for an even count, the mean of the middle two. */
export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median of nothing');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

export function summarize(values: number[]): BenchSummary {
  return { n: values.length, medianMs: Math.round(median(values)), p95Ms: Math.round(percentile(values, 95)) };
}
