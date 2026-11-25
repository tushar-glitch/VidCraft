# VidCraft

Video tools (compress, resize) built on a small job pipeline: the browser uploads straight to object storage, a worker runs ffmpeg, and the user downloads the result.

```
apps/api        Express API: auth, jobs (routes → services → repositories)
apps/worker     pg-boss consumer that runs ffmpeg operations
apps/web        React frontend
packages/shared Contracts shared by all apps; server-only helpers under /server
db/migrations   SQL migrations (node-pg-migrate)
legacy/         Original v0 code, reference only
```

## Run locally

Requires Node 22.12+, Docker, and ffmpeg/ffprobe on your PATH.

```sh
cp .env.example .env          # then set JWT_SECRET to a long random string
npm install
docker compose up -d --wait postgres storage
docker compose run --rm storage-init   # creates the bucket (first time only)
npm run migrate

npm run dev:api      # http://localhost:4000
npm run dev:worker
npm run dev:web      # http://localhost:5173 (proxies /api to the API)
```

Local infrastructure: Postgres on port 5442, S3-compatible storage (SeaweedFS) on port 8333.
In production, storage is Cloudflare R2: point the `STORAGE_*` variables at it.

## How a job flows

1. `POST /api/v1/jobs` with the file name, size and task → returns the job and a signed `uploadUrl`.
2. The browser `PUT`s the file to `uploadUrl` (the API never handles video bytes).
3. `POST /api/v1/jobs/:id/start` → the API checks the upload and queues the job.
4. The worker downloads the file, runs ffmpeg and reports progress, uploads the result, and deletes the original.
5. `GET /api/v1/jobs/:id` → status, progress and, once completed, a short-lived `downloadUrl`.

## Video library (streamable videos)

Separate from the quick tools: a signed-in user uploads a video and the worker converts it to HLS
(adaptive streaming) for use in feeds.

1. `POST /api/v1/videos` → the video and a signed `uploadUrl` for the original (private bucket).
2. The browser `PUT`s the file, then `POST /api/v1/videos/:id/start`.
3. The worker probes the file (including phone rotation flags), then one ffmpeg run produces every
   quality: up to 1080p, 720p, 540p and 360p by the shorter side, never upscaled. Segments are 2 s
   fMP4, and keyframes are forced on the same grid in every quality so players can switch cleanly.
   It also makes a thumbnail.
4. Playlists, segments and the thumbnail go to the **public** media bucket (`STORAGE_MEDIA_BUCKET`) under
   `hls/<id>/`, cached as immutable. Originals stay in the private bucket and are deleted once converted.
5. `GET /api/v1/videos/:id` → `streamingUrl` (master playlist) and `thumbnailUrl` when ready.
   `PATCH` renames or publishes/unpublishes; `DELETE` removes the row and all files.

In production, serve the media bucket through a CDN or an R2 public domain and set `MEDIA_BASE_URL`.

## Playback analytics

The feed SDK reports how playback goes, and the dashboard (Analytics in the sidebar) turns it into numbers.

- **Ingest:** `POST /api/v1/events` is public (the SDK runs on other sites), takes batches of up to 100 events as
  `text/plain` JSON (so it needs no CORS preflight and works with `sendBeacon` on page close), validates every event
  against the schemas in `packages/shared`, keeps the good ones, and is rate limited to 120 requests a minute per IP.
- **What is recorded:** impressions, time to first frame (with a stage-by-stage breakdown: playlist, quality playlist,
  first chunk download, decode and draw), stalls, quality changes, watch time and errors. Each play of a video has a
  `viewId` that ties its events together. A random per-tab session id is the only identifier; nothing personal is sent.
- **Dashboard API (signed in, only your own videos):** `GET /api/v1/analytics/overview?days=`,
  `/analytics/slowest?days=&limit=` and `/analytics/views/:viewId`. Everything is computed from the raw events in
  `playback_events` with SQL.
- **Speed buckets** use the player's own bandwidth measurement (slow under 1, medium 1 to 5, fast over 5 Mbit/s), which
  works in every browser, unlike the Network Information API.

Events are never deleted yet. Before real traffic, add a retention job (for example, drop events older than 90 days).

## Webhooks

Add a URL under Webhooks in the dashboard and VidCraft sends it a signed `POST` when a video finishes converting
(`video.ready`) or cannot be converted (`video.failed`), plus a `ping` on demand.

- **Signing:** `X-VidCraft-Signature: t=<unix seconds>,v1=<HMAC-SHA256 of "<t>.<raw body>">`, with a per-endpoint secret
  shown once. Receivers reject bad signatures and anything older than 5 minutes. The verification code on the Docs page
  is the same file the tests run (`apps/web/src/docs/verify-signature.js`).
- **Delivery:** done by the worker through the queue. A non-2xx answer or a 10-second timeout is retried five more times
  with growing waits; the delivery id is the same on every retry. Every attempt is recorded and can be resent.
- **Safety:** a webhook is the server calling a URL a user chose, so it is refused for private networks, loopback and
  cloud-metadata addresses. The check runs on the address actually connected to (so a name that later points
  somewhere internal is caught), redirects are never followed, and credentials in URLs are rejected.
  `WEBHOOK_ALLOW_PRIVATE=true` relaxes this for local development only.
- **Failure messages** shown to users and sent in `video.failed` are generic; the real cause (which can include commands
  and server paths) goes to the log only.

## Benchmark

`apps/bench` compares the SDK feed with a plain hls.js feed (one player per video, defaults) under emulated networks:
real Chrome with a phone viewport, fresh profile per session, one meter outside both feeds timing each video from the swipe
to the first moving frame, feeds taking turns going first, a discarded warm-up, and a rest between sessions.

```sh
npm run bench -w @vidcraft/bench -- --reps 4    # needs the API running with 6+ published videos, and Chrome
```

Results are written to `apps/bench/results/` and published to `apps/web/src/data/benchmark.json`, which the Benchmarks page
shows. Don't edit server code while it runs: the dev servers restart on every change and ruin the session in progress.

## Production

```sh
cp .env.production.example .env.production      # fill it in
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Postgres, one-shot migrations, the API, the worker and nginx (serving the site, proxying `/api`, and serving the SDK
with permissive CORS so other sites can load it). Object storage is external: Cloudflare R2 with one private and one
publicly readable bucket. Put TLS in front: the session cookie is `Secure` in production. `TRUST_PROXY` is set for the API
behind nginx so the per-IP rate limit sees real visitors. The compose project has its own name so it can't touch the
development volumes.

## Checks

```sh
npm run typecheck
npm test             # worker tests run the real ffmpeg commands on a generated clip
```
