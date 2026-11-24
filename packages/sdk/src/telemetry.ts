import type { FeedEvent, TelemetryContext } from './types.ts';

export const SDK_VERSION = '0.1.0';

const FLUSH_EVERY_MS = 5000;
const SEND_WHEN_QUEUED = 20;
const MAX_PER_REQUEST = 100; // the server's limit
const MAX_QUEUED = 200; // if the server is unreachable, keep only the newest

/** Random id for a view or session. Uses getRandomValues, which (unlike randomUUID) also works on plain http. */
export function newId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
}

let cachedSession: string | null = null;
function sessionId(): string {
  if (cachedSession) return cachedSession;
  try {
    cachedSession = sessionStorage.getItem('vidcraft:session');
    if (!cachedSession) sessionStorage.setItem('vidcraft:session', (cachedSession = newId()));
  } catch {
    cachedSession ??= newId(); // storage blocked: a per-page id is fine
  }
  return cachedSession;
}

/** What is known about the viewer's environment. Nothing here identifies a person. */
export function browserContext(): TelemetryContext {
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  return {
    sessionId: sessionId(),
    network: connection?.effectiveType ?? null,
    device: matchMedia('(pointer: coarse)').matches ? 'touch' : 'desktop',
    sdk: SDK_VERSION,
  };
}

/** Delivers a batch. `unloading` means the page is closing, so use a method that survives that. */
export type Send = (url: string, body: string, unloading: boolean) => Promise<boolean>;

export const defaultSend: Send = async (url, body, unloading) => {
  // text/plain keeps this a "simple" request: no CORS preflight, and sendBeacon can send it.
  if (unloading && typeof navigator.sendBeacon === 'function') return navigator.sendBeacon(url, body);
  try {
    const res = await fetch(url, { method: 'POST', body, keepalive: true, credentials: 'omit', headers: { 'content-type': 'text/plain;charset=UTF-8' } });
    return res.ok;
  } catch {
    return false;
  }
};

/** Collects events and sends them to the server in batches, without ever getting in playback's way. */
export class Telemetry {
  private queue: FeedEvent[] = [];
  private inFlight = false;
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly url: string,
    private readonly context: () => TelemetryContext = browserContext,
    private readonly send: Send = defaultSend,
    flushEveryMs = FLUSH_EVERY_MS,
  ) {
    this.timer = setInterval(() => void this.flush(), flushEveryMs);
  }

  track(event: FeedEvent): void {
    this.queue.push(event);
    if (this.queue.length > MAX_QUEUED) this.queue.splice(0, this.queue.length - MAX_QUEUED);
    if (this.queue.length >= SEND_WHEN_QUEUED) void this.flush();
  }

  /** Sends what is queued. While the page is closing, requests can't be awaited, so it never waits for a reply. */
  async flush(unloading = false): Promise<void> {
    if (this.queue.length === 0 || (this.inFlight && !unloading)) return;
    const batch = this.queue.splice(0, MAX_PER_REQUEST);
    this.inFlight = true;
    try {
      const delivered = await this.send(this.url, JSON.stringify({ context: this.context(), events: batch }), unloading);
      // A failed send puts the events back to retry on the next tick. At unload there is no next tick.
      if (!delivered && !unloading) this.queue.unshift(...batch);
    } finally {
      this.inFlight = false;
    }
    if (this.queue.length >= SEND_WHEN_QUEUED && !unloading) void this.flush();
  }

  destroy(): void {
    clearInterval(this.timer);
    void this.flush(true);
  }
}
