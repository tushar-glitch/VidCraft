// Server-only helpers shared by the API and the worker. Never import this from the web app.
import pg from 'pg';
import { PgBoss } from 'pg-boss';
import { pino } from 'pino';
import type { BaseEnv } from './env.ts';
import { ObjectStorage } from './storage.ts';
import { WEBHOOK_QUEUE } from './webhook-emitter.ts';

export * from './env.ts';
export * from './storage.ts';
export * from './jobs.repository.ts';
export * from './videos.repository.ts';
export * from './webhooks.ts';
export * from './webhooks.repository.ts';
export * from './webhook-emitter.ts';
export type { JobWithMetadata } from 'pg-boss';

/** Quick tools (compress, resize). Payload: VideoJobMessage. */
export const VIDEO_QUEUE = 'video.process';
export interface VideoJobMessage {
  jobId: string;
}

/** Library videos being converted to streamable HLS. Payload: HlsJobMessage. */
export const HLS_QUEUE = 'video.hls';
export interface HlsJobMessage {
  videoId: string;
}

export function createLogger(env: Pick<BaseEnv, 'LOG_LEVEL' | 'NODE_ENV'>, name: string) {
  return pino({ name, level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL });
}
export type Logger = ReturnType<typeof createLogger>;

export const createPool = (env: Pick<BaseEnv, 'DATABASE_URL'>) =>
  new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });

export const createStorage = (env: BaseEnv) =>
  new ObjectStorage({
    endpoint: env.STORAGE_ENDPOINT,
    bucket: env.STORAGE_BUCKET,
    accessKey: env.STORAGE_ACCESS_KEY,
    secretKey: env.STORAGE_SECRET_KEY,
    region: env.STORAGE_REGION,
  });

/** The public media bucket: HLS playlists, segments and thumbnails. */
export const createMediaStorage = (env: BaseEnv) =>
  new ObjectStorage({
    endpoint: env.STORAGE_ENDPOINT,
    bucket: env.STORAGE_MEDIA_BUCKET,
    accessKey: env.STORAGE_ACCESS_KEY,
    secretKey: env.STORAGE_SECRET_KEY,
    region: env.STORAGE_REGION,
  });

/** Turns a media-bucket key into the public URL a player can fetch. */
export function mediaUrlFor(env: BaseEnv): (key: string) => string {
  const base = (env.MEDIA_BASE_URL ?? `${env.STORAGE_ENDPOINT.replace(/\/$/, '')}/${env.STORAGE_MEDIA_BUCKET}`).replace(/\/$/, '');
  return (key) => `${base}/${key}`;
}

/** Starts pg-boss (it creates its own `pgboss` schema) and makes sure our queues exist. */
export async function startQueue(env: Pick<BaseEnv, 'DATABASE_URL'>, logger: Logger): Promise<PgBoss> {
  const boss = new PgBoss(env.DATABASE_URL);
  boss.on('error', (err) => logger.error({ err }, 'pg-boss error'));
  await boss.start();
  for (const queue of [VIDEO_QUEUE, HLS_QUEUE]) {
    await boss.createQueue(queue, {
      retryLimit: 2,
      retryDelay: 10,
      retryBackoff: true,
      expireInSeconds: 60 * 60, // a single ffmpeg run longer than an hour is treated as stuck
    });
  }
  // A webhook that fails is retried six times in all, waiting longer each time (about 30 s, 1 min, 2 min, 4 min, 8 min).
  await boss.createQueue(WEBHOOK_QUEUE, { retryLimit: 5, retryDelay: 30, retryBackoff: true, expireInSeconds: 60 });
  return boss;
}
