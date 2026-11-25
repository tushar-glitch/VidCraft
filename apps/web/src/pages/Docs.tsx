import type { ReactNode } from 'react';
import { Link } from 'react-router';
import verifyCode from '../docs/verify-signature.js?raw';

const origin = typeof location === 'undefined' ? 'https://your-vidcraft-host' : location.origin;

const EMBED = `<div id="feed" style="width: 360px; height: 640px"></div>

<script src="${origin}/sdk/vidcraft.js"></script>
<script>
  VidCraft.createFeed(document.getElementById('feed'), {
    apiUrl: '${origin}/api/v1',
  });
</script>`;

const MODULE = `import { createFeed } from '@vidcraft/sdk';

const feed = createFeed(document.getElementById('feed'), {
  apiUrl: '${origin}/api/v1',
  onEvent: (event) => console.log(event.type, event),
});

feed.next();      // scroll to the next video
feed.destroy();   // stop playback and remove the feed`;

const PAYLOAD = `POST /your-endpoint
Content-Type: application/json
X-VidCraft-Event: video.ready
X-VidCraft-Delivery: 7b0f5b0e-4c3a-4d3f-9a53-2f1d0c8e6a11
X-VidCraft-Signature: t=1795460000,v1=3b7f…

{
  "id": "7b0f5b0e-4c3a-4d3f-9a53-2f1d0c8e6a11",
  "type": "video.ready",
  "createdAt": "2026-11-25T09:30:00.000Z",
  "data": {
    "videoId": "4f0c9a52-2b1e-4d6e-9a53-0d6b6d9a1f10",
    "title": "Morning run",
    "durationSec": 8,
    "width": 720,
    "height": 1280,
    "streamingUrl": "https://…/hls/4f0c9a52-…/master.m3u8",
    "thumbnailUrl": "https://…/hls/4f0c9a52-…/thumb.jpg"
  }
}`;

const SECTIONS = [
  ['quickstart', 'Quickstart'],
  ['options', 'SDK options'],
  ['events', 'Events'],
  ['api', 'HTTP API'],
  ['webhooks', 'Webhooks'],
  ['notes', 'Good to know'],
] as const;

export function Docs() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-bold text-gray-800">Docs</h1>
      <p className="mt-3 text-lg text-gray-600">
        Add a swipeable vertical video feed to any website, and see how it performs. Videos you upload here are converted for streaming and appear in the feed once you publish them.
      </p>
      <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="text-brand hover:underline">{label}</a>
        ))}
      </nav>

      <Section id="quickstart" title="Quickstart">
        <p>
          <Link to="/dashboard/videos" className="text-brand underline">Upload a video</Link> and publish it, then paste this into any page. The container needs a height; the feed styles itself.
        </p>
        <Code>{EMBED}</Code>
        <p>Or, in a project with a bundler, import the SDK as a module:</p>
        <Code>{MODULE}</Code>
        <p>The feed works on any website: the feed and event endpoints accept requests from any origin and never use cookies. You can see it running on the <Link to="/explore" className="text-brand underline">Explore page</Link>, which is built with this same SDK.</p>
      </Section>

      <Section id="options" title="SDK options">
        <Table
          head={['Option', 'Default', 'What it does']}
          rows={[
            ['apiUrl', '—', 'Base URL of the VidCraft API. Needed unless you pass items.'],
            ['items', '—', 'Use a fixed list of videos instead of fetching the feed.'],
            ['pageSize', '10', 'Videos fetched per request. More are fetched as the viewer nears the end.'],
            ['poolSize', '3', 'How many video players to keep and reuse: the current video, the next and the previous.'],
            ['startMuted', 'true', 'Browsers only allow autoplay without sound. The viewer can turn sound on.'],
            ['loop', 'true', 'Replay a video when it ends.'],
            ['telemetry', 'on with apiUrl', 'Report playback quality to the dashboard. Pass false to turn off, or { url } to send elsewhere.'],
            ['onEvent', '—', 'Called for every event below.'],
          ]}
        />
        <p>Methods: <code>next()</code>, <code>prev()</code>, <code>goTo(index)</code> and <code>destroy()</code>. The feed also responds to the keyboard (↑ ↓, space to pause, M to mute), the mouse wheel and touch.</p>
      </Section>

      <Section id="events" title="Events">
        <p>Every event has a <code>viewId</code>, which ties together everything that happened during one play of one video, and <code>t</code>, the time it happened.</p>
        <Table
          head={['Event', 'When', 'Main fields']}
          rows={[
            ['impression', 'A video becomes the current one.', 'itemId, index'],
            ['firstFrame', 'The first moving picture appears.', 'startupMs, preloaded, quality, bandwidthKbps, breakdown'],
            ['rebuffer', 'Playback stalled to load, then resumed.', 'durationMs'],
            ['qualityChange', 'The player switched quality.', 'from, to'],
            ['viewEnd', 'The viewer moved on or left.', 'watchTimeMs, completed'],
            ['error', 'A video could not be played.', 'message'],
          ]}
        />
        <p>
          <code>breakdown</code> splits <code>startupMs</code> into <code>manifestMs</code>, <code>levelMs</code>, <code>fragmentMs</code> and <code>renderMs</code>: the playlist, the quality playlist, the first chunk of video, and decoding and drawing it. Only time the viewer actually waited counts, so a preloaded video shows pure render time. The <Link to="/dashboard/analytics" className="text-brand underline">Analytics</Link> page charts all of this.
        </p>
      </Section>

      <Section id="api" title="HTTP API">
        <p>Everything lives under <code>/api/v1</code>. Public endpoints need nothing. The rest use your sign-in session; API keys for server-to-server use are not built yet.</p>
        <Table
          head={['Endpoint', 'Access', 'What it does']}
          rows={[
            ['GET /feed?limit=&cursor=', 'public', 'Published, ready videos, newest first, with a cursor for the next page.'],
            ['POST /events', 'public', 'Playback events from the SDK: up to 100 per request, rate limited.'],
            ['POST /videos', 'signed in', 'Create a video. Returns an uploadUrl to PUT the file to.'],
            ['POST /videos/:id/start', 'signed in', 'After the upload: verify it and start converting.'],
            ['GET /videos, GET /videos/:id', 'signed in', 'Your videos and their status, qualities and streaming URL.'],
            ['PATCH /videos/:id', 'signed in', 'Rename, publish or unpublish.'],
            ['DELETE /videos/:id', 'signed in', 'Delete the video and all its files.'],
            ['GET /analytics/overview?days=', 'signed in', 'Views, start-up times, stalls, by day and by connection speed.'],
            ['GET /analytics/slowest, /analytics/views/:viewId', 'signed in', 'The slowest starts, and the trace of any single play.'],
            ['GET, POST /webhooks and more', 'signed in', 'Manage webhooks. See below.'],
          ]}
        />
        <p>Uploads go straight to storage, not through the API, so large files don't tie up the server. New uploads start unpublished: the feed is public, so you choose what appears in it.</p>
      </Section>

      <Section id="webhooks" title="Webhooks">
        <p>
          Add a URL under <Link to="/dashboard/webhooks" className="text-brand underline">Webhooks</Link> and VidCraft sends it a <code>POST</code> when a video finishes converting (<code>video.ready</code>) or cannot be converted (<code>video.failed</code>). You can also send yourself a <code>ping</code> to test.
        </p>
        <Code>{PAYLOAD}</Code>
        <h3 className="mt-6 font-semibold text-gray-800">Check that it really came from VidCraft</h3>
        <p>
          Each request is signed with your endpoint's secret, which is shown once when you create it. The signature covers the timestamp and the exact body, so a changed body or an old, replayed request fails. Verify it before you trust anything in the request, using the raw body text:
        </p>
        <Code>{verifyCode.trim()}</Code>
        <h3 className="mt-6 font-semibold text-gray-800">Delivery</h3>
        <ul className="list-disc space-y-1 pl-6">
          <li>Answer with any <code>2xx</code> status within 10 seconds. Anything else counts as a failure.</li>
          <li>Failures are retried five more times, waiting longer each time (roughly 30 seconds up to several minutes). The delivery id stays the same on every retry, so you can ignore duplicates.</li>
          <li>See every attempt, and resend any delivery, from the dashboard.</li>
          <li>URLs must be public <code>https</code> addresses. Redirects are not followed, and addresses on private networks are refused.</li>
        </ul>
      </Section>

      <Section id="notes" title="Good to know">
        <ul className="list-disc space-y-1 pl-6">
          <li>Uploads are limited to 50 MB without an account and 200 MB with one. Videos are converted to up to 1080p, 720p, 540p and 360p (never larger than the original).</li>
          <li>Playback events carry a random per-tab session id, the device type, and the browser's connection class when it offers one. Nothing that identifies a person.</li>
          <li>Results from the SDK compared with a plain feed are on the <Link to="/benchmarks" className="text-brand underline">Benchmarks</Link> page, with how they were measured.</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-6 space-y-4 text-gray-700">
      <h2 className="border-b pb-2 text-2xl font-semibold text-gray-800">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm leading-relaxed text-gray-100">
      <code>{children}</code>
    </pre>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs text-gray-600 uppercase">
            {head.map((h) => (
              <th key={h} className="py-2 pr-4 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b align-top">
              {row.map((cell, i) => (
                <td key={i} className={`py-2 pr-4 ${i === 0 ? 'font-mono text-xs whitespace-nowrap text-gray-800' : ''}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
