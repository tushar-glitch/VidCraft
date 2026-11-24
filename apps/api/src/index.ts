// Composition root: build every dependency once, wire them together, start listening.
import {
  createLogger,
  createMediaStorage,
  createPool,
  createStorage,
  JobsRepository,
  mediaUrlFor,
  startQueue,
  VideosRepository,
} from '@vidcraft/shared/server';
import { createApp } from './app.ts';
import { loadApiConfig } from './config.ts';
import type { Enqueue } from './db.ts';
import { AuthService } from './modules/auth/auth.service.ts';
import { UsersRepository } from './modules/auth/users.repository.ts';
import { AnalyticsRepository } from './modules/analytics/analytics.repository.ts';
import { AnalyticsService } from './modules/analytics/analytics.service.ts';
import { FeedService } from './modules/feed/feed.service.ts';
import { JobsService } from './modules/jobs/jobs.service.ts';
import { VideosService } from './modules/videos/videos.service.ts';

const config = loadApiConfig();
const logger = createLogger(config, 'api');
const pool = createPool(config);
const storage = createStorage(config);
const boss = await startQueue(config, logger);

// Sends through the caller's connection, so the queue insert commits (or rolls back) with its transaction.
const enqueue: Enqueue = async (queue, data, db) => {
  await boss.send(queue, data, { db: { executeSql: (text, values) => db.query(text, values) } });
};

const auth = new AuthService(new UsersRepository(pool), config.JWT_SECRET);
const jobs = new JobsService(pool, new JobsRepository(pool), storage, enqueue);
const mediaUrl = mediaUrlFor(config);
const videoRepo = new VideosRepository(pool);
const videos = new VideosService(pool, videoRepo, storage, createMediaStorage(config), mediaUrl, enqueue);
const feed = new FeedService(videoRepo, mediaUrl);
const analyticsRepo = new AnalyticsRepository(pool);
const analytics = new AnalyticsService(analyticsRepo);

const app = createApp({
  logger,
  webOrigin: config.WEB_ORIGIN,
  secureCookies: config.NODE_ENV === 'production',
  auth,
  jobs,
  videos,
  feed,
  analytics,
  analyticsRepo,
  checkHealth: async () => {
    await pool.query('select 1');
  },
});

const server = app.listen(config.PORT, () => logger.info(`API listening on http://localhost:${config.PORT}`));

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down');
  server.close();
  await boss.stop({ graceful: true });
  await pool.end();
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
