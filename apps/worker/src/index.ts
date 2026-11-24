import { z } from 'zod';
import {
  baseEnvSchema,
  createLogger,
  createMediaStorage,
  createPool,
  createStorage,
  HLS_QUEUE,
  JobsRepository,
  loadEnv,
  startQueue,
  VideosRepository,
  VIDEO_QUEUE,
  type HlsJobMessage,
  type JobWithMetadata,
  type VideoJobMessage,
} from '@vidcraft/shared/server';
import { createHlsProcessor } from './process-hls.ts';
import { createJobProcessor } from './process-job.ts';

const config = loadEnv(
  baseEnvSchema.extend({
    FFMPEG_PATH: z.string().default('ffmpeg'),
    FFPROBE_PATH: z.string().default('ffprobe'),
    /** Videos processed at the same time by this worker process. ffmpeg is CPU-heavy. */
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
  }),
);
const logger = createLogger(config, 'worker');
const pool = createPool(config);
const boss = await startQueue(config, logger);

const storage = createStorage(config);
const ffmpeg = { ffmpegPath: config.FFMPEG_PATH, ffprobePath: config.FFPROBE_PATH };

const processJob = createJobProcessor({ jobs: new JobsRepository(pool), storage, logger, ...ffmpeg });
const processHls = createHlsProcessor({
  videos: new VideosRepository(pool),
  storage,
  media: createMediaStorage(config),
  logger,
  ...ffmpeg,
});

const options = { includeMetadata: true, localConcurrency: config.WORKER_CONCURRENCY } as const;
await boss.work(VIDEO_QUEUE, options, async ([job]: JobWithMetadata<VideoJobMessage>[]) => {
  if (!job) return;
  await processJob({ jobId: job.data.jobId, isLastAttempt: job.retryCount >= job.retryLimit });
});
await boss.work(HLS_QUEUE, options, async ([job]: JobWithMetadata<HlsJobMessage>[]) => {
  if (!job) return;
  await processHls({ videoId: job.data.videoId, isLastAttempt: job.retryCount >= job.retryLimit });
});
logger.info({ concurrency: config.WORKER_CONCURRENCY }, `Worker listening on queues "${VIDEO_QUEUE}" and "${HLS_QUEUE}"`);

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down; letting active jobs finish');
  await boss.stop({ graceful: true });
  await pool.end();
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
