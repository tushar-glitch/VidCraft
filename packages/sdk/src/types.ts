/** A video in the feed. Matches what `GET /api/v1/feed` returns. */
export interface FeedItem {
  id: string;
  title: string;
  /** HLS master playlist URL. */
  streamingUrl: string;
  thumbnailUrl: string;
  durationSec: number;
  width: number;
  height: number;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}

/** What is known about the viewer's environment when reporting. Nothing here identifies a person. */
export interface TelemetryContext {
  /** Random per browser tab session. */
  sessionId: string;
  /** Browser-reported connection class ("4g", "3g"…), when it offers one. */
  network: string | null;
  device: 'touch' | 'desktop';
  sdk: string;
}

/** Where the time to first frame went. The four parts add up to `startupMs`. */
export interface StartupBreakdown {
  /** Fetching the master playlist (the list of qualities). */
  manifestMs: number;
  /** Fetching the playlist for the chosen quality. */
  levelMs: number;
  /** Downloading the first piece of video. */
  fragmentMs: number;
  /** Decoding it and getting the first picture on screen. */
  renderMs: number;
}

/**
 * Everything the SDK reports. Each event carries `t` (when it happened, ms since epoch) and `viewId`,
 * which ties together all the events of one play of one video. This is also the shape sent to the server.
 */
export type FeedEvent = { t: number; viewId: string } & (
  | { type: 'impression'; itemId: string; index: number }
  | {
      type: 'firstFrame';
      itemId: string;
      index: number;
      /**
       * From the video becoming the current one to the first new frame being presented after play().
       * Browsers add their own frame-presentation delay on top of loading (about 100 ms measured in
       * headless Chrome), so compare numbers taken in the same browser rather than reading them as absolutes.
       */
      startupMs: number;
      /** True when the video was already loaded in the background before the user got to it. */
      preloaded: boolean;
      /** Shorter side in pixels of the quality that started playing, e.g. 720 for 720p. */
      quality: number | null;
      /** The player's bandwidth estimate when playback started, in kbit/s. */
      bandwidthKbps: number | null;
      breakdown: StartupBreakdown;
      /** Size of the first piece of video, in bytes. */
      fragmentBytes: number | null;
    }
  | { type: 'rebuffer'; itemId: string; durationMs: number }
  | { type: 'qualityChange'; itemId: string; from: number | null; to: number }
  | { type: 'viewEnd'; itemId: string; index: number; watchTimeMs: number; completed: boolean }
  | { type: 'error'; itemId: string; message: string }
);

export interface FeedOptions {
  /** Base URL of the VidCraft API, e.g. "https://api.example.com/api/v1". Needed unless `items` is given. */
  apiUrl?: string;
  /** Use a fixed list instead of fetching one. */
  items?: FeedItem[];
  /** Videos fetched per request. Default 10. */
  pageSize?: number;
  /** How many video players to keep and reuse. Default 3: the current video, the next, and the previous. */
  poolSize?: number;
  /** Start without sound, which browsers require for autoplay. Default true. */
  startMuted?: boolean;
  /** Replay a video when it ends. Default true. */
  loop?: boolean;
  /**
   * Send playback events (start-up time, stalls, quality, watch time) to the VidCraft server so they
   * show up in the dashboard. On by default when `apiUrl` is set; pass `false` to turn it off.
   * Events carry a random per-tab session id and no personal data.
   */
  telemetry?: false | { url?: string };
  onEvent?: (event: FeedEvent) => void;
}

export interface Feed {
  next(): void;
  prev(): void;
  goTo(index: number): void;
  /** Stops playback, frees the players and removes the feed from the page. */
  destroy(): void;
  readonly activeIndex: number;
  /** How many `<video>` elements the feed uses in total, however long the feed is. */
  readonly poolSize: number;
}
