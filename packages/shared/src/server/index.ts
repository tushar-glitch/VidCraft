// Server-only helpers shared by the API and the worker. Never import this from the web app.
import pg from 'pg';
import { PgBoss } from 'pg-boss';
import { pino } from 'pino';
import type { BaseEnv } from './env.ts';
import { ObjectStorage } from './storage.ts';

export * from './env.ts';
export * from './storage.ts';
export * from './jobs.repository.ts';
export type { JobWithMetadata } from 'pg-boss';

/** Queue the API sends to and the worker consumes. Payload: VideoJobMessage. */
export const VIDEO_QUEUE = 'video.process';
export interface VideoJobMessage {
  jobId: string;
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

/** Starts pg-boss (it creates its own `pgboss` schema) and makes sure our queue exists. */
export async function startQueue(env: Pick<BaseEnv, 'DATABASE_URL'>, logger: Logger): Promise<PgBoss> {
  const boss = new PgBoss(env.DATABASE_URL);
  boss.on('error', (err) => logger.error({ err }, 'pg-boss error'));
  await boss.start();
  await boss.createQueue(VIDEO_QUEUE, {
    retryLimit: 2,
    retryDelay: 10,
    retryBackoff: true,
    expireInSeconds: 60 * 60, // a single ffmpeg run longer than an hour is treated as stuck
  });
  return boss;
}
