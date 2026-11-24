const KEY = 'vidcraft:bandwidth:v1';
/** Assumed connection speed on a first visit: low enough to start at a modest quality and step up. */
export const DEFAULT_BANDWIDTH_BPS = 1_000_000;
const MIN_BPS = 100_000;
const MAX_BPS = 50_000_000;
const SAVE_EVERY_MS = 2000;

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Remembers how fast the viewer's connection was, so the next video, and the next visit,
 * can start at a sensible quality instead of guessing from nothing.
 */
export class BandwidthStore {
  private bps: number;
  private lastSaved = 0;

  constructor(
    private readonly storage: KeyValueStore | null = safeLocalStorage(),
    private readonly now: () => number = () => Date.now(),
  ) {
    this.bps = clamp(Number(this.read()) || DEFAULT_BANDWIDTH_BPS);
  }

  /** Best current guess, in bits per second. */
  get(): number {
    return this.bps;
  }

  /** Feed in a measurement. Junk values (0, NaN, Infinity) are ignored. */
  update(measuredBps: number): void {
    if (!Number.isFinite(measuredBps) || measuredBps <= 0) return;
    this.bps = clamp(measuredBps);
    const t = this.now();
    if (t - this.lastSaved < SAVE_EVERY_MS) return; // measurements arrive constantly; don't write each one
    this.lastSaved = t;
    try {
      this.storage?.setItem(KEY, String(Math.round(this.bps)));
    } catch {
      // storage can be full or blocked (private mode): the in-memory value still works
    }
  }

  private read(): string | null {
    try {
      return this.storage?.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  }
}

const clamp = (n: number) => Math.min(MAX_BPS, Math.max(MIN_BPS, n));

function safeLocalStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // accessing localStorage can itself throw when storage is blocked
  }
}
