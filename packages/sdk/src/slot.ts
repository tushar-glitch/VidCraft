/// <reference path="./hls-light.d.ts" />
import Hls from 'hls.js/light';
import type { BandwidthStore } from './bandwidth.ts';
import { startupBreakdown, type LoadMarks } from './breakdown.ts';
import { newId } from './telemetry.ts';
import type { FeedItem, StartupBreakdown } from './types.ts';

/** `preload` loads just enough to start instantly; `active` buffers ahead for smooth playback. */
export type SlotMode = 'active' | 'preload';

/** Seconds of video to keep buffered. A preloaded video only needs its first couple of segments. */
const BUFFER_SECONDS: Record<SlotMode, number> = { active: 20, preload: 4 };
const HAVE_FUTURE_DATA = 3;

export interface FirstFrameInfo {
  startupMs: number;
  preloaded: boolean;
  quality: number | null;
  bandwidthKbps: number | null;
  breakdown: StartupBreakdown;
  fragmentBytes: number | null;
}

/** What a slot reports back to the feed. */
export interface SlotHost {
  firstFrame(slot: Slot, info: FirstFrameInfo): void;
  rebuffer(slot: Slot, durationMs: number): void;
  qualityChange(slot: Slot, from: number | null, to: number): void;
  error(slot: Slot, message: string): void;
  /** The browser refused to play with sound, so the slot muted itself. */
  mutedByBrowser(): void;
}

export interface ViewSummary {
  watchTimeMs: number;
  completed: boolean;
}

/**
 * One reusable player: a `<video>` element plus its streaming engine.
 * The feed owns a small fixed number of these and moves them between videos as the user swipes.
 * Reusing the same element matters on phones, where a browser's permission to autoplay
 * belongs to the element: a fresh element per video would be blocked, a reused one is not.
 */
export class Slot {
  readonly video = document.createElement('video');
  item: FeedItem | null = null;
  index = -1;
  /** The viewer tapped pause; don't auto-resume when the tab becomes visible again. */
  userPaused = false;
  /** Identifies the current play of this video; every event about it carries this id. */
  viewId = '';

  private hls: Hls | null = null;
  private viewOpen = false;
  private marks: LoadMarks = { assignedAt: 0 };
  private mode: SlotMode = 'preload';
  private activatedAt = 0;
  private preloaded = false;
  private firstFrameDone = false;
  private viewToken = 0;
  private playingSince: number | null = null;
  private watchMs = 0;
  private completed = false;
  private stallSince: number | null = null;
  private quality: number | null = null;
  private networkRetries = 0;
  private mediaRetries = 0;
  /** Whether the viewer wants sound. A video playing ahead of time stays silent regardless. */
  private wantMuted: boolean;
  private prerolling = false;

  constructor(
    private readonly host: SlotHost,
    private readonly bandwidth: BandwidthStore,
    loop: boolean,
    muted: boolean,
  ) {
    this.wantMuted = muted;
    const v = this.video;
    v.className = 'vc-video';
    v.muted = muted;
    v.loop = loop;
    v.playsInline = true;
    v.preload = 'auto';
    v.disablePictureInPicture = true;
    v.setAttribute('playsinline', ''); // older iOS reads the attribute, not the property
    v.addEventListener('playing', this.onPlaying);
    v.addEventListener('pause', this.onPause);
    v.addEventListener('waiting', this.onWaiting);
    v.addEventListener('timeupdate', this.onTimeUpdate);
    v.addEventListener('error', this.onVideoError);
  }

  /** Point this player at a video and start loading it in the background. */
  assign(item: FeedItem, index: number, slide: HTMLElement, before: Element | null): void {
    this.release();
    this.item = item;
    this.index = index;
    this.networkRetries = 0;
    this.mediaRetries = 0;
    this.userPaused = false;
    this.mode = 'preload';
    this.marks = { assignedAt: performance.now() };
    slide.insertBefore(this.video, before);

    if (Hls.isSupported()) {
      const hls = (this.hls ??= this.createHls());
      this.applyBuffer();
      hls.loadSource(item.streamingUrl);
      hls.attachMedia(this.video);
    } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      this.video.src = item.streamingUrl; // Safari plays HLS natively
    } else {
      this.host.error(this, 'This browser cannot play HLS video');
    }
  }

  setMode(mode: SlotMode): void {
    this.mode = mode;
    this.applyBuffer();
  }

  setMuted(muted: boolean): void {
    this.wantMuted = muted;
    if (!this.prerolling) this.video.muted = muted;
  }

  /**
   * The viewer has started swiping towards this video: start it moving now, silently, so that it is
   * already playing as it slides into view. Starting a paused video costs the browser 100 ms or more
   * before the first moving frame, and this hides that behind the swipe. It is cheap because the
   * video is already loaded, and it is undone by cancelPreroll() if the viewer changes their mind.
   */
  preroll(): void {
    if (this.prerolling || !this.item || !this.video.paused) return;
    this.prerolling = true;
    this.video.muted = true;
    this.play();
  }

  /** The viewer didn't go there after all: stop and rewind, ready to be the next video again. */
  cancelPreroll(): void {
    if (!this.prerolling) return;
    this.prerolling = false;
    this.video.muted = this.wantMuted;
    this.video.pause();
    if (this.video.currentTime > 0) this.video.currentTime = 0;
  }

  /** This video just became the one on screen: play it from the top (or carry on, if it was playing ahead). */
  activate(now: number): void {
    this.setMode('active');
    this.viewToken++;
    this.viewId = newId();
    this.viewOpen = true;
    this.activatedAt = now;
    this.preloaded = this.video.readyState >= HAVE_FUTURE_DATA;
    this.firstFrameDone = false;
    this.watchMs = 0;
    this.completed = false;
    this.stallSince = null;
    this.userPaused = false;
    this.playingSince = this.prerolling && !this.video.paused ? performance.now() : null; // watch time starts now, not at the pre-roll
    this.prerolling = false;
    this.video.muted = this.wantMuted;
    // A short pre-roll is simply carried on. A video that was watched earlier starts over.
    if (this.video.currentTime > 1) this.video.currentTime = 0;
    this.armFirstFrame();
    this.play();
  }

  play(): void {
    this.video.play().catch((err: DOMException) => {
      if (err.name === 'NotAllowedError' && !this.video.muted) {
        // Autoplay with sound was refused: fall back to muted playback, which is always allowed.
        this.video.muted = true;
        this.host.mutedByBrowser();
        this.video.play().catch(() => {});
      }
      // AbortError just means a newer load or pause interrupted this play(); nothing to do.
    });
  }

  pause(): void {
    this.video.pause();
  }

  /**
   * The viewer is done with this video: return how long they watched, and reset.
   * Returns null if the view was already finished, so a view is never reported twice.
   */
  finishView(): ViewSummary | null {
    if (!this.viewOpen) return null;
    this.viewOpen = false;
    this.accumulateWatchTime();
    const summary = { watchTimeMs: Math.round(this.watchMs), completed: this.completed };
    this.viewToken++;
    this.watchMs = 0;
    this.completed = false;
    return summary;
  }

  /** Stop loading and detach from the page so the player can be reused for another video. */
  release(): void {
    this.viewToken++;
    this.prerolling = false;
    this.video.muted = this.wantMuted;
    this.pause();
    if (this.hls) {
      this.hls.stopLoad();
      this.hls.detachMedia();
    } else {
      this.video.removeAttribute('src');
      this.video.load();
    }
    this.video.remove();
    this.item = null;
    this.index = -1;
    this.playingSince = null;
    this.stallSince = null;
    this.quality = null;
  }

  destroy(): void {
    this.release();
    this.hls?.destroy();
    this.hls = null;
    const v = this.video;
    v.removeEventListener('playing', this.onPlaying);
    v.removeEventListener('pause', this.onPause);
    v.removeEventListener('waiting', this.onWaiting);
    v.removeEventListener('timeupdate', this.onTimeUpdate);
    v.removeEventListener('error', this.onVideoError);
  }

  private createHls(): Hls {
    const hls = new Hls({
      // Start from what we last measured instead of a built-in guess.
      abrEwmaDefaultEstimate: this.bandwidth.get(),
      // Don't download 1080p into a phone-sized player.
      capLevelToPlayerSize: true,
      // Release played video from memory, which matters with several players alive.
      backBufferLength: 5,
      lowLatencyMode: false,
    });
    hls.on(Hls.Events.FRAG_BUFFERED, () => this.bandwidth.update(hls.bandwidthEstimate));
    // Remember when each loading stage finished (first occurrence only), to explain a slow start later.
    hls.on(Hls.Events.MANIFEST_LOADED, () => (this.marks.manifestAt ??= performance.now()));
    hls.on(Hls.Events.LEVEL_LOADED, () => (this.marks.levelAt ??= performance.now()));
    hls.on(Hls.Events.FRAG_LOADED, (_e, data) => {
      if (this.marks.fragAt !== undefined) return;
      this.marks.fragAt = performance.now();
      this.marks.fragBytes = data.frag.stats.total;
    });
    hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
      const level = hls.levels[data.level];
      const height = level ? Math.min(level.width, level.height) : 0; // vertical video is named by its width, like "720p"
      if (!height) return;
      const from = this.quality;
      this.quality = height;
      if (from !== null && from !== height && this.item && this.mode === 'active') {
        this.host.qualityChange(this, from, height);
      }
    });
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR && this.networkRetries++ < 2) return hls.startLoad();
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && this.mediaRetries++ < 1) return hls.recoverMediaError();
      this.host.error(this, `${data.type}: ${data.details}`);
    });
    return hls;
  }

  private applyBuffer(): void {
    if (!this.hls) return;
    const seconds = BUFFER_SECONDS[this.mode];
    this.hls.config.maxBufferLength = seconds;
    this.hls.config.maxMaxBufferLength = seconds;
  }

  /** Report the moment a frame is actually shown after play(), not merely when play() was called. */
  private armFirstFrame(): void {
    const token = this.viewToken;
    const done = () => {
      if (token !== this.viewToken || this.firstFrameDone) return;
      this.firstFrameDone = true;
      const frameAt = performance.now();
      // The player's estimate is only a measurement once something has been downloaded; before that it's our guess.
      const estimate = this.hls?.bandwidthEstimate;
      this.host.firstFrame(this, {
        startupMs: frameAt - this.activatedAt,
        preloaded: this.preloaded,
        // What is actually on screen. hls.js announces a level switch only after the first chunk is buffered,
        // which on a slow cold start is later than the first frame, so the picture's own size is the reliable source.
        quality: this.video.videoWidth > 0 ? Math.min(this.video.videoWidth, this.video.videoHeight) : this.quality,
        bandwidthKbps: this.marks.fragAt !== undefined && estimate && Number.isFinite(estimate) ? Math.round(estimate / 1000) : null,
        breakdown: startupBreakdown(this.marks, this.activatedAt, frameAt),
        fragmentBytes: this.marks.fragBytes ?? null,
      });
    };
    // Older browsers (and Firefox before 132) lack requestVideoFrameCallback; "playing" is a close stand-in.
    if (typeof this.video.requestVideoFrameCallback === 'function') this.video.requestVideoFrameCallback(done);
    else this.video.addEventListener('playing', done, { once: true });
  }

  private accumulateWatchTime(): void {
    if (this.playingSince === null) return;
    this.watchMs += performance.now() - this.playingSince;
    this.playingSince = null;
  }

  private readonly onPlaying = () => {
    if (this.playingSince === null) this.playingSince = performance.now();
    if (this.stallSince !== null) {
      const ms = performance.now() - this.stallSince;
      this.stallSince = null;
      if (this.item && ms > 0) this.host.rebuffer(this, Math.round(ms));
    }
  };

  private readonly onPause = () => this.accumulateWatchTime();

  private readonly onWaiting = () => {
    // Only a stall if playback had really begun; seeking back to the start of a loop is not one.
    if (this.firstFrameDone && !this.video.seeking && !this.video.paused && this.stallSince === null) {
      this.stallSince = performance.now();
    }
  };

  private readonly onTimeUpdate = () => {
    const { currentTime, duration } = this.video;
    if (!this.completed && duration > 0 && currentTime / duration >= 0.95) this.completed = true;
  };

  private readonly onVideoError = () => {
    // With hls.js, errors arrive through its own handler; this covers native playback only.
    if (!this.hls && this.item) this.host.error(this, `Video error ${this.video.error?.code ?? ''}`.trim());
  };
}
