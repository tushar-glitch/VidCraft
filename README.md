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

## Checks

```sh
npm run typecheck
npm test             # worker tests run the real ffmpeg commands on a generated clip
```
