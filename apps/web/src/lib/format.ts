export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  // Number() drops trailing zeros: "50 MB", not "50.0 MB".
  return `${Number(value.toFixed(value < 10 ? 2 : 1))} ${units[i]}`;
}

/** 182 -> "182 ms", 1840 -> "1.84 s" */
export const formatMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${Number((ms / 1000).toFixed(2))} s`);

export const formatPercent = (share: number) => `${Number((share * 100).toFixed(share < 0.1 ? 1 : 0))}%`;

/** 4_350_000 -> "1h 12m", 260_000 -> "4m 20s", 7300 -> "7s" */
export function formatWatchTime(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** 5200 -> "5.2 Mbit/s", 640 -> "640 kbit/s" */
export const formatKbps = (kbps: number) => (kbps >= 1000 ? `${Number((kbps / 1000).toFixed(1))} Mbit/s` : `${kbps} kbit/s`);

export const formatDate =(iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
