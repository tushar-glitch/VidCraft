/// <reference path="./hls-light.d.ts" />
import Hls from 'hls.js/light';

interface Item {
  id: string;
  title: string;
  streamingUrl: string;
  thumbnailUrl: string;
}

const CSS = `
.naive-scroller{position:absolute;inset:0;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none;background:#000}
.naive-scroller::-webkit-scrollbar{display:none}
.naive-slide{position:relative;height:100%;scroll-snap-align:start;scroll-snap-stop:always;overflow:hidden;background:#000}
.naive-slide img,.naive-slide video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
`;

/**
 * The baseline: a vertical feed the way most developers write it the first time.
 *
 * Each slide gets its own `<video>` and its own hls.js player, created when the slide is mostly on
 * screen and destroyed when it leaves. hls.js runs on its defaults. It uses the same video engine
 * (the light build of hls.js) and the same videos as the SDK, so any difference in the benchmark
 * comes from how the SDK manages players, loading and quality, not from a different player.
 *
 * Deliberately absent, because it is what the SDK adds: reusing players, loading the next video
 * early, remembering bandwidth, limiting quality to the screen size, and capping what is buffered.
 */
export async function mountNaiveFeed(container: HTMLElement, apiUrl: string): Promise<void> {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const scroller = document.createElement('div');
  scroller.className = 'naive-scroller';
  container.appendChild(scroller);

  const page = (await (await fetch(`${apiUrl}/feed?limit=10`)).json()) as { items: Item[] };
  const players = new Map<Element, { hls: Hls; video: HTMLVideoElement }>();

  function start(slide: HTMLElement, item: Item) {
    if (players.has(slide)) return;
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    const hls = new Hls();
    hls.loadSource(item.streamingUrl);
    hls.attachMedia(video);
    slide.appendChild(video);
    video.play().catch(() => {});
    players.set(slide, { hls, video });
  }

  function stop(slide: Element) {
    const player = players.get(slide);
    if (!player) return;
    player.hls.destroy();
    player.video.remove();
    players.delete(slide);
  }

  const slides = page.items.map((item) => {
    const slide = document.createElement('div');
    slide.className = 'naive-slide';
    const poster = document.createElement('img');
    poster.src = item.thumbnailUrl;
    poster.alt = '';
    slide.appendChild(poster);
    scroller.appendChild(slide);
    return { slide, item };
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const found = slides.find((s) => s.slide === entry.target);
        if (!found) continue;
        if (entry.intersectionRatio >= 0.6) start(found.slide, found.item);
        else stop(found.slide);
      }
    },
    { root: scroller, threshold: [0, 0.6] },
  );
  slides.forEach((s) => observer.observe(s.slide));
}
