import { BandwidthStore } from './bandwidth.ts';
import { Slot, type SlotHost } from './slot.ts';
import { injectStyles } from './styles.ts';
import type { Feed, FeedEvent, FeedItem, FeedOptions, FeedPage } from './types.ts';
import { playerWindow } from './window.ts';

/** Faster than this (px per ms) the viewer is flicking past: don't start videos they're about to skip. */
const FLICK_PX_PER_MS = 1.5;
/** If scrolling stops without ever settling exactly on a slide, activate the nearest after this long. */
const SETTLE_MS = 120;
/** Fetch the next page when this close to the end. */
const LOAD_MORE_WITHIN = 3;

const ICON_SOUND = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
const ICON_MUTED = '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

async function fetchFeedPage(apiUrl: string, limit: number, cursor: string | null): Promise<FeedPage> {
  const url = new URL(`${apiUrl.replace(/\/$/, '')}/feed`, location.href);
  url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);
  const res = await fetch(url, { credentials: 'omit' }); // public endpoint: never send the host site's cookies
  if (!res.ok) throw new Error(`Feed request failed (${res.status})`);
  return (await res.json()) as FeedPage;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
  const node = document.createElement(tag);
  node.className = className;
  return node;
};

/**
 * Mounts a swipeable vertical video feed into `container` (which needs a height).
 *
 * The idea: a feed can be thousands of videos long, but only a few are ever loaded.
 * A small fixed pool of players follows the viewer: one plays the current video while the
 * others hold the next and previous ones, already buffered, so a swipe starts instantly.
 */
export function createFeed(container: HTMLElement, options: FeedOptions): Feed {
  injectStyles();
  const poolSize = Math.max(1, options.poolSize ?? 3);
  const pageSize = options.pageSize ?? 10;
  const bandwidth = new BandwidthStore();

  const items: FeedItem[] = [];
  const slides: HTMLElement[] = [];
  const assigned = new Map<number, Slot>();
  let activeIndex = -1;
  let nextCursor: string | null = null;
  let loadingMore = false;
  let destroyed = false;
  let muted = options.startMuted ?? true;
  let feedVisible = true;

  // Omit<> applied to each event shape separately, so every event keeps its own fields.
  type EventInput = FeedEvent extends infer E ? (E extends unknown ? Omit<E, 't'> : never) : never;
  const emit = (event: EventInput) => {
    try {
      options.onEvent?.({ t: Date.now(), ...event } as FeedEvent);
    } catch (err) {
      console.error('VidCraft onEvent handler threw', err); // a host's bug must never stop playback
    }
  };

  // ---- DOM ----
  const root = el('div', 'vc-feed');
  root.tabIndex = 0;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Video feed');
  const scroller = el('div', 'vc-scroller');
  const muteButton = el('button', 'vc-mute');
  muteButton.type = 'button';
  const progress = el('div', 'vc-progress');
  const progressBar = document.createElement('i');
  progress.appendChild(progressBar);
  const pausedIcon = el('div', 'vc-paused-icon');
  pausedIcon.innerHTML = `<span>${ICON_PLAY}</span>`;
  root.append(scroller, muteButton, progress, pausedIcon);
  container.appendChild(root);

  // ---- Players ----
  const host: SlotHost = {
    firstFrame: (slot, startupMs, preloaded, quality) =>
      slot.item && emit({ type: 'firstFrame', itemId: slot.item.id, index: slot.index, startupMs: Math.round(startupMs), preloaded, quality }),
    rebuffer: (slot, durationMs) => slot.item && emit({ type: 'rebuffer', itemId: slot.item.id, durationMs }),
    qualityChange: (slot, from, to) => slot.item && emit({ type: 'qualityChange', itemId: slot.item.id, from, to }),
    error: (slot, message) => {
      if (!slot.item) return;
      emit({ type: 'error', itemId: slot.item.id, message });
      const slide = slides[slot.index];
      if (slide && !slide.querySelector('.vc-slide-error')) {
        const note = el('div', 'vc-slide-error');
        note.textContent = "Couldn't play this video. Tap to retry.";
        slide.appendChild(note);
      }
    },
    mutedByBrowser: () => setMuted(true),
  };

  const free: Slot[] = [];
  for (let i = 0; i < poolSize; i++) {
    const slot = new Slot(host, bandwidth, options.loop ?? true, muted);
    slot.video.addEventListener('timeupdate', () => {
      const { currentTime, duration } = slot.video;
      if (slot.index === activeIndex && duration > 0) progressBar.style.width = `${(currentTime / duration) * 100}%`;
    });
    free.push(slot);
  }

  // ---- Muting ----
  function setMuted(next: boolean) {
    muted = next;
    for (const slot of [...assigned.values(), ...free]) slot.video.muted = next;
    muteButton.innerHTML = muted ? ICON_MUTED : ICON_SOUND;
    muteButton.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
  }
  setMuted(muted);
  muteButton.addEventListener('click', (e) => {
    e.stopPropagation();
    setMuted(!muted);
  });

  // ---- Slides ----
  function addSlides(newItems: FeedItem[]) {
    const known = new Set(items.map((i) => i.id));
    for (const item of newItems) {
      if (known.has(item.id)) continue;
      const index = items.push(item) - 1;
      const slide = el('div', 'vc-slide');
      if (item.width >= item.height) slide.classList.add('vc-landscape');
      const poster = el('img', 'vc-poster');
      poster.src = item.thumbnailUrl;
      poster.alt = '';
      poster.draggable = false;
      poster.loading = index < 3 ? 'eager' : 'lazy';
      const meta = el('div', 'vc-meta');
      const title = el('div', 'vc-title');
      title.textContent = item.title; // textContent, never innerHTML: titles are user input
      meta.appendChild(title);
      slide.append(poster, meta);
      scroller.appendChild(slide);
      slides.push(slide);
    }
  }

  // ---- Which video has a player, and which one plays ----

  /** Give every video in the window a player (current first, so it gets the network first). */
  function rebalance(): Slot | undefined {
    const want = playerWindow(activeIndex, items.length, poolSize);
    for (const [index, slot] of assigned) {
      if (want.includes(index)) continue;
      slot.release();
      assigned.delete(index);
      free.push(slot);
    }
    for (const index of want) {
      if (assigned.has(index)) continue;
      const slot = free.pop();
      const item = items[index];
      const slide = slides[index];
      if (!slot || !item || !slide) continue;
      slot.assign(item, index, slide, slide.querySelector('.vc-meta'));
      assigned.set(index, slot);
    }
    for (const [index, slot] of assigned) {
      if (index !== activeIndex) {
        slot.setMode('preload'); // neighbours only need to be ready, not to buffer far ahead
        slot.pause();
      }
    }
    return assigned.get(activeIndex);
  }

  function activate(index: number) {
    if (index === activeIndex || index < 0 || index >= items.length) return;
    const now = performance.now();

    const leaving = assigned.get(activeIndex);
    if (leaving?.item) {
      const view = leaving.finishView();
      emit({ type: 'viewEnd', itemId: leaving.item.id, index: activeIndex, ...view });
      leaving.pause();
    }

    activeIndex = index;
    root.classList.remove('vc-is-paused');
    progressBar.style.width = '0%';
    const active = rebalance();
    if (!active?.item) return;
    active.activate(now);
    syncPlayback();
    emit({ type: 'impression', itemId: active.item.id, index });
    if (index >= items.length - LOAD_MORE_WITHIN) void loadMore();
  }

  /** Play only while the feed is on screen, the tab is visible, and the viewer hasn't paused it. */
  function syncPlayback() {
    const active = assigned.get(activeIndex);
    if (!active) return;
    const shouldPlay = feedVisible && !document.hidden && !active.userPaused;
    if (shouldPlay && active.video.paused) active.play();
    else if (!shouldPlay && !active.video.paused) active.pause();
  }

  function togglePause() {
    const active = assigned.get(activeIndex);
    if (!active) return;
    if (active.video.paused) {
      active.userPaused = false;
      active.play();
      root.classList.remove('vc-is-paused');
    } else {
      active.userPaused = true;
      active.pause();
      root.classList.add('vc-is-paused');
    }
  }

  async function loadMore() {
    if (loadingMore || nextCursor === null || !options.apiUrl) return;
    loadingMore = true;
    try {
      const page = await fetchFeedPage(options.apiUrl, pageSize, nextCursor);
      if (destroyed) return;
      nextCursor = page.nextCursor;
      addSlides(page.items);
      if (activeIndex >= 0) rebalance(); // the new videos may include the "next" one we were missing
    } catch {
      // Not fatal: the next swipe near the end tries again.
    } finally {
      loadingMore = false;
    }
  }

  // ---- Input ----
  const nearestIndex = () => Math.min(items.length - 1, Math.max(0, Math.round(scroller.scrollTop / (scroller.clientHeight || 1))));

  let lastTop = 0;
  let lastTime = performance.now();
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  scroller.addEventListener(
    'scroll',
    () => {
      const now = performance.now();
      const top = scroller.scrollTop;
      const speed = Math.abs(top - lastTop) / Math.max(1, now - lastTime);
      lastTop = top;
      lastTime = now;
      clearTimeout(settleTimer);

      const target = nearestIndex();
      if (target === activeIndex) return;
      const settled = Math.abs(top - target * scroller.clientHeight) <= 1;
      // Start the next video as soon as it is mostly on screen, but not while the viewer is
      // flicking past it: that would load videos they never watch and delay the one they stop on.
      if (settled || speed < FLICK_PX_PER_MS) activate(target);
      else settleTimer = setTimeout(() => activate(nearestIndex()), SETTLE_MS);
    },
    { passive: true },
  );
  scroller.addEventListener('scrollend', () => activate(nearestIndex()));

  scroller.addEventListener('click', (e) => {
    const slide = (e.target as Element).closest<HTMLElement>('.vc-slide');
    const index = slide ? slides.indexOf(slide) : -1;
    if (index !== activeIndex) return;
    if (slide?.querySelector('.vc-slide-error')) return retry(index);
    togglePause();
  });

  function retry(index: number) {
    const slot = assigned.get(index);
    const item = items[index];
    const slide = slides[index];
    if (!slot || !item || !slide) return;
    slide.querySelector('.vc-slide-error')?.remove();
    slot.assign(item, index, slide, slide.querySelector('.vc-meta'));
    slot.activate(performance.now());
  }

  const goTo = (index: number) => {
    if (index < 0 || index >= items.length) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ top: index * scroller.clientHeight, behavior: reduce ? 'auto' : 'smooth' });
  };

  root.addEventListener('keydown', (e) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => goTo(activeIndex + 1),
      PageDown: () => goTo(activeIndex + 1),
      ArrowUp: () => goTo(activeIndex - 1),
      PageUp: () => goTo(activeIndex - 1),
      ' ': togglePause,
      m: () => setMuted(!muted),
    };
    const action = keys[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  });
  root.addEventListener('pointerenter', () => root.focus({ preventScroll: true }));

  const onVisibility = () => syncPlayback();
  document.addEventListener('visibilitychange', onVisibility);
  const intersection = new IntersectionObserver(([entry]) => {
    feedVisible = (entry?.intersectionRatio ?? 1) >= 0.3;
    syncPlayback();
  }, { threshold: [0, 0.3, 1] });
  intersection.observe(root);
  // If the feed is resized (rotated phone, resized window), stay aligned on the current slide.
  const resize = new ResizeObserver(() => {
    if (activeIndex >= 0) scroller.scrollTop = activeIndex * scroller.clientHeight;
  });
  resize.observe(scroller);

  // ---- Start ----
  function showMessage(text: string, onRetry?: () => void) {
    root.querySelector('.vc-message')?.remove();
    const box = el('div', 'vc-message');
    box.textContent = text;
    if (onRetry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Try again';
      button.addEventListener('click', onRetry);
      box.appendChild(button);
    }
    root.appendChild(box);
  }

  function start(first: FeedPage) {
    root.querySelector('.vc-message')?.remove();
    nextCursor = first.nextCursor;
    addSlides(first.items);
    if (items.length === 0) return showMessage('No videos yet.');
    activate(0);
  }

  if (options.items) {
    start({ items: options.items, nextCursor: null });
  } else if (options.apiUrl) {
    const apiUrl = options.apiUrl;
    const load = () => {
      showMessage('Loading…');
      fetchFeedPage(apiUrl, pageSize, null).then(
        (page) => !destroyed && start(page),
        () => !destroyed && showMessage("Couldn't load the feed.", load),
      );
    };
    load();
  } else {
    showMessage('Feed is not configured: pass `apiUrl` or `items`.');
  }

  return {
    next: () => goTo(activeIndex + 1),
    prev: () => goTo(activeIndex - 1),
    goTo,
    destroy() {
      if (destroyed) return;
      const active = assigned.get(activeIndex);
      if (active?.item) emit({ type: 'viewEnd', itemId: active.item.id, index: activeIndex, ...active.finishView() });
      destroyed = true;
      clearTimeout(settleTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      intersection.disconnect();
      resize.disconnect();
      for (const slot of [...assigned.values(), ...free]) slot.destroy();
      assigned.clear();
      root.remove();
    },
    get activeIndex() {
      return activeIndex;
    },
    poolSize,
  };
}
