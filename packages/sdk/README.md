# @vidcraft/sdk

A swipeable vertical video feed for the web, built to start videos fast.

```ts
import { createFeed } from '@vidcraft/sdk';

const feed = createFeed(document.getElementById('feed')!, {
  apiUrl: 'https://your-vidcraft-host/api/v1',
  onEvent: (e) => console.log(e), // impression, firstFrame, rebuffer, qualityChange, viewEnd, error
});
// feed.next(), feed.prev(), feed.goTo(i), feed.destroy()
```

The container needs a height. The feed styles itself (every class is prefixed `vc-`).

## How it keeps swipes instant

- **A fixed pool of players.** A feed can be thousands of videos long, but only `poolSize` (default 3)
  `<video>` elements ever exist. They follow the viewer: current video, next, previous. Reusing the
  same elements also keeps a phone browser's permission to autoplay, which belongs to the element.
- **Preloading with a budget.** The next and previous videos load in the background, but only about
  4 seconds each; the current video buffers about 20 seconds ahead.
- **Flick-aware activation.** A video starts as soon as it is mostly on screen, but not while the viewer
  is flicking past it, so skipped videos are never started.
- **Starting quality.** The SDK remembers the viewer's measured bandwidth (in `localStorage`, with an
  in-memory fallback) so the next video and the next visit start at a fitting quality. It never
  downloads a quality larger than the player's on-screen size.
- **Small download.** It uses the light build of hls.js (no subtitles or DRM). About 120 KB gzipped.
- **Good citizen.** Pauses when the tab is hidden or the feed scrolls out of view; falls back to muted
  playback if the browser refuses sound; uses Safari's built-in HLS where hls.js isn't supported.

## Events

`firstFrame.startupMs` is measured from the video becoming current to the first new frame being
presented. Browsers add their own frame-presentation delay (about 100 ms in headless Chrome), so
compare numbers taken in the same browser instead of treating them as absolutes.

## Build

```sh
npm run build -w @vidcraft/sdk   # dist/vidcraft.es.js and dist/vidcraft.iife.js
npm test -w @vidcraft/sdk
```
