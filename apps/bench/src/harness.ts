import { TIMEOUT_MS, WATCH_MS } from './constants.ts';

/** One measurement. `startMs` is null if the video never played within the time limit. */
export interface Sample {
  startMs: number | null;
  stalls: number;
  stallMs: number;
  /** Shorter side in pixels of the picture that was playing (720 means 720p). */
  quality: number | null;
}

export interface BenchApi {
  /** Mounts the feed and measures the first video, from the moment of mounting. */
  coldStart(): Promise<Sample>;
  /** Swipes to the video at `index` and measures it, from the moment of the swipe. */
  swipe(index: number): Promise<Sample>;
}

declare global {
  interface Window {
    __bench?: BenchApi;
  }
}

const FAILED: Sample = { startMs: null, stalls: 0, stallMs: 0, quality: null };

/**
 * The meter. It sits outside both feeds and looks only at what a viewer would see: the `<video>` in the
 * slide and when it actually shows a moving picture. The same code measures every implementation, so
 * neither one grades itself.
 */
export function installHarness(opts: { scroller: string; mount: (container: HTMLElement) => void }): void {
  const container = document.getElementById('feed')!;
  const scroller = () => container.querySelector<HTMLElement>(opts.scroller);
  const slideAt = (i: number) => scroller()?.children[i] as HTMLElement | undefined;

  /** Resolves once `find` returns something, watching the page for changes. */
  function waitFor<T>(find: () => T | undefined, timeoutMs: number): Promise<T | undefined> {
    return new Promise((resolve) => {
      const now = find();
      if (now) return resolve(now);
      const observer = new MutationObserver(() => {
        const found = find();
        if (found) done(found);
      });
      const timer = setTimeout(() => done(undefined), timeoutMs);
      function done(value: T | undefined) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(value);
      }
      observer.observe(container, { childList: true, subtree: true });
    });
  }

  /** Milliseconds from t0 until the slide's video presents a frame beyond the very first one, while playing. */
  function firstMovingFrame(slide: HTMLElement, t0: number): Promise<{ startMs: number; video: HTMLVideoElement } | null> {
    return new Promise((resolve) => {
      let watched: HTMLVideoElement | null = null;
      let finished = false;
      const observer = new MutationObserver(() => {
        const v = slide.querySelector('video');
        if (v) watch(v);
      });
      const timer = setTimeout(() => finish(null), TIMEOUT_MS);
      function finish(result: { startMs: number; video: HTMLVideoElement } | null) {
        if (finished) return;
        finished = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve(result);
      }
      function watch(video: HTMLVideoElement) {
        if (watched === video) return; // a feed that swaps its video element is followed to the new one
        watched = video;
        const onFrame = (_now: number, meta: VideoFrameCallbackMetadata) => {
          if (finished || watched !== video) return;
          if (meta.mediaTime > 0.04 && !video.paused) finish({ startMs: performance.now() - t0, video });
          else video.requestVideoFrameCallback(onFrame);
        };
        video.requestVideoFrameCallback(onFrame);
      }
      observer.observe(slide, { childList: true, subtree: true });
      const existing = slide.querySelector('video');
      if (existing) watch(existing);
    });
  }

  /** Counts the times playback ran dry (and for how long) during the next `ms` of watching. */
  function watchStalls(video: HTMLVideoElement, ms: number): Promise<{ stalls: number; stallMs: number }> {
    return new Promise((resolve) => {
      let stalls = 0;
      let stallMs = 0;
      let since: number | null = null;
      const onWaiting = () => {
        if (video.seeking || since !== null) return; // a loop restarting is not a stall
        since = performance.now();
        stalls++;
      };
      const onPlaying = () => {
        if (since === null) return;
        stallMs += performance.now() - since;
        since = null;
      };
      video.addEventListener('waiting', onWaiting);
      video.addEventListener('playing', onPlaying);
      setTimeout(() => {
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('playing', onPlaying);
        if (since !== null) stallMs += performance.now() - since; // still stalled when the window closed
        resolve({ stalls, stallMs: Math.round(stallMs) });
      }, ms);
    });
  }

  async function measure(slide: HTMLElement, t0: number): Promise<Sample> {
    const hit = await firstMovingFrame(slide, t0);
    if (!hit) return FAILED;
    const { video, startMs } = hit;
    const quality = video.videoWidth > 0 ? Math.min(video.videoWidth, video.videoHeight) : null;
    return { startMs: Math.round(startMs), quality, ...(await watchStalls(video, WATCH_MS)) };
  }

  window.__bench = {
    async coldStart() {
      const t0 = performance.now();
      opts.mount(container);
      const slide = await waitFor(() => slideAt(0), TIMEOUT_MS);
      return slide ? measure(slide, t0) : FAILED;
    },
    async swipe(index) {
      const sc = scroller();
      const slide = slideAt(index);
      if (!sc || !slide) return FAILED;
      const t0 = performance.now();
      sc.scrollTo({ top: index * sc.clientHeight, behavior: 'smooth' });
      return measure(slide, t0);
    },
  };
}
