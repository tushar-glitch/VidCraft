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
- **Starting ahead of the swipe.** A paused video needs the browser 100 ms or more to show its first moving
  frame once told to play. So when the viewer starts swiping towards the next or previous video (already
  loaded, since it has a player), it begins playing, silently, about 12% of the way through the swipe: it is
  already moving as it slides into view. If the viewer changes their mind it stops and rewinds.
- **Flick-aware activation.** The next or previous video becomes the current one as soon as it is half on
  screen. A video further away (a programmatic jump, a dragged scrollbar) waits until the viewer slows down or
  stops, so videos flicked past are never started or loaded. (An earlier version applied this wait to every
  swipe, which added the whole swipe animation to each start; the benchmark showed it.)
- **Starting quality.** The SDK remembers the viewer's measured bandwidth (in `localStorage`, with an
  in-memory fallback) so the next video and the next visit start at a fitting quality. It never
  downloads a quality larger than the player's on-screen size.
- **Small download.** It uses the light build of hls.js (no subtitles or DRM). About 120 KB gzipped.
- **Good citizen.** Pauses when the tab is hidden or the feed scrolls out of view; falls back to muted
  playback if the browser refuses sound; uses Safari's built-in HLS where hls.js isn't supported.

## Telemetry

When `apiUrl` is set, the SDK reports playback events to `${apiUrl}/events` in batches (every 5 seconds, or at
20 events, and when the page is hidden or closed). Pass `telemetry: false` to turn it off, or `telemetry: { url }` to
send elsewhere. It sends a random per-tab session id, the device type (touch or desktop), the browser's connection
class when it offers one, and the events below. Nothing that identifies a person. Failed sends are retried, and a
backlog is capped at the newest 200 events, so a down server can never grow memory or slow playback.

## Events

`firstFrame.startupMs` is measured from the video becoming current to the first new frame being
presented. Browsers add their own frame-presentation delay (about 100 ms in headless Chrome), so
compare numbers taken in the same browser instead of treating them as absolutes.

## Build

```sh
npm run build -w @vidcraft/sdk   # dist/vidcraft.es.js and dist/vidcraft.iife.js
npm test -w @vidcraft/sdk
```
