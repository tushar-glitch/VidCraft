import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { JobsRepository, Logger, ObjectStorage } from '@vidcraft/shared/server';
import { probe, runFfmpeg, userMessage } from './ffmpeg.ts';
import { buildFfmpegArgs, contentTypeOf } from './operations.ts';

export interface ProcessorDeps {
  jobs: JobsRepository;
  storage: ObjectStorage;
  logger: Logger;
  ffmpegPath: string;
  ffprobePath: string;
}

export interface Attempt {
  jobId: string;
  /** True when the queue will not retry after this attempt. */
  isLastAttempt: boolean;
}

/** Download → probe → ffmpeg → upload. Temp files are always cleaned up. */
export function createJobProcessor({ jobs, storage, logger, ffmpegPath, ffprobePath }: ProcessorDeps) {
  return async function processJob({ jobId, isLastAttempt }: Attempt): Promise<void> {
    const log = logger.child({ jobId });
    const job = await jobs.findById(jobId);
    if (!job) return log.warn('Job no longer exists; skipping');
    if (job.status === 'completed') return log.info('Job already completed; skipping');

    // 'processing' covers a retry after a crash mid-run.
    if (job.status === 'queued') await jobs.transition(job.id, 'queued', 'processing');
    await jobs.setProgress(job.id, 0);

    const dir = await mkdtemp(path.join(os.tmpdir(), `vidcraft-${job.id}-`));
    try {
      const input = path.join(dir, 'input');
      const format = job.task.params.format;
      const output = path.join(dir, `output.${format}`);

      await storage.downloadToFile(job.inputKey, input);
      const source = await probe(ffprobePath, input);
      log.info({ operation: job.task.operation, source }, 'Processing');

      let lastSaved = -1;
      let saving = Promise.resolve();
      await runFfmpeg(ffmpegPath, buildFfmpegArgs(job.task, { input, output, source }), source.durationSec, (pct) => {
        // Write at most once per 5% so a long video doesn't flood the database.
        if (pct < lastSaved + 5) return;
        lastSaved = pct;
        saving = saving.then(() => jobs.setProgress(job.id, pct)).catch((err) => log.warn({ err }, 'Progress update failed'));
      });
      await saving;

      const outputKey = `outputs/${job.id}/output.${format}`;
      await storage.uploadFile(outputKey, output, contentTypeOf(format));
      await jobs.complete(job.id, outputKey, (await stat(output)).size);
      await storage.remove(job.inputKey); // originals aren't kept once processed
      log.info('Completed');
    } catch (err) {
      log.error({ err, isLastAttempt }, 'Processing failed');
      if (isLastAttempt) await jobs.fail(job.id, userMessage(err)); // the detail is in the log above; users never see paths or commands
      throw err; // lets the queue schedule a retry
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
}
