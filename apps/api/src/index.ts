// Composition root: build every dependency once, wire them together, start listening.
import { createLogger, createPool, createStorage, JobsRepository, startQueue, VIDEO_QUEUE } from '@vidcraft/shared/server';
import { createApp } from './app.ts';
import { loadApiConfig } from './config.ts';
import { AuthService } from './modules/auth/auth.service.ts';
import { UsersRepository } from './modules/auth/users.repository.ts';
import { JobsService } from './modules/jobs/jobs.service.ts';

const config = loadApiConfig();
const logger = createLogger(config, 'api');
const pool = createPool(config);
const storage = createStorage(config);
const boss = await startQueue(config, logger);

const auth = new AuthService(new UsersRepository(pool), config.JWT_SECRET);
const jobs = new JobsService(pool, new JobsRepository(pool), storage, async (jobId, db) => {
  await boss.send(VIDEO_QUEUE, { jobId }, { db: { executeSql: (text, values) => db.query(text, values) } });
});

const app = createApp({
  logger,
  webOrigin: config.WEB_ORIGIN,
  secureCookies: config.NODE_ENV === 'production',
  auth,
  jobs,
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
