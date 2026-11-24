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

/** Everything the SDK reports. Each event also carries `t`, the time it happened (ms since epoch). */
export type FeedEvent = { t: number } & (
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
