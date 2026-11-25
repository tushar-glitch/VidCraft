# syntax=docker/dockerfile:1
# One Dockerfile, one target per service:
#   docker build --target api    -t vidcraft-api .
#   docker build --target worker -t vidcraft-worker .
#   docker build --target web    -t vidcraft-web .
#   docker build --target migrate -t vidcraft-migrate .
# docker-compose.prod.yml builds and wires them all.

# ---- Dependencies: installed once, from the lockfile, and shared by every target ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/sdk/package.json packages/sdk/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY apps/bench/package.json apps/bench/
RUN npm ci

# ---- API ----
# ponytail: runs the TypeScript directly with tsx, and ships dev dependencies too. A compiled, pruned image would
# be smaller and start faster; do that when image size or start-up time starts to matter.
FROM deps AS api
ENV NODE_ENV=production
COPY packages/shared packages/shared
COPY apps/api apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1
CMD ["node_modules/.bin/tsx", "apps/api/src/index.ts"]

# ---- Worker: the same, plus ffmpeg ----
FROM deps AS worker
ENV NODE_ENV=production
RUN apk add --no-cache ffmpeg
COPY packages/shared packages/shared
COPY apps/worker apps/worker
USER node
CMD ["node_modules/.bin/tsx", "apps/worker/src/index.ts"]

# ---- Migrations: run once per release, then exit ----
FROM deps AS migrate
COPY db db
USER node
CMD ["node_modules/.bin/node-pg-migrate", "up", "-m", "db/migrations", "--migration-file-language", "sql"]

# ---- Web: built to static files, served by nginx ----
FROM deps AS web-build
COPY packages packages
COPY apps/web apps/web
# Builds the SDK, copies it into the site, then builds the site.
RUN npm run build -w @vidcraft/web

FROM nginx:alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
