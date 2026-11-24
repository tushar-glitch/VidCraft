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

## Checks

```sh
npm run typecheck
npm test             # worker tests run the real ffmpeg commands on a generated clip
```
