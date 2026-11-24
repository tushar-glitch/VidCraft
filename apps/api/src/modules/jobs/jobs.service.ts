import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type pg from 'pg';
import { UPLOAD_LIMITS, type CreateJobRequest, type CreateJobResponse, type JobDto } from '@vidcraft/shared';
import { VIDEO_QUEUE, type Job, type JobsRepository, type ObjectStorage } from '@vidcraft/shared/server';
import { inTransaction, type Enqueue } from '../../db.ts';
import { HttpError } from '../../http/errors.ts';

const uploadLimit = (userId: string | undefined) => (userId ? UPLOAD_LIMITS.user : UPLOAD_LIMITS.anonymous);

const tooLarge = (limit: number) =>
  new HttpError(413, 'file_too_large', `File is larger than ${limit / 1024 / 1024} MB`, { limitBytes: limit });

export class JobsService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly jobs: JobsRepository,
    private readonly storage: ObjectStorage,
    private readonly enqueue: Enqueue,
  ) {}

  /** Step 1: record the job and hand back a URL the browser uploads the file to. */
  async create(userId: string | undefined, req: CreateJobRequest): Promise<CreateJobResponse> {
    const limit = uploadLimit(userId);
    if (req.fileSize > limit) throw tooLarge(limit);

    const id = randomUUID();
    // The user's file name never becomes part of the storage key.
    const ext = path.extname(req.fileName).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10);
    const job = await this.jobs.create({
      id,
      userId: userId ?? null,
      task: req.task,
      inputName: req.fileName,
      inputSize: req.fileSize,
      inputKey: `inputs/${id}/source${ext}`,
    });
    return { job: await this.toDto(job), uploadUrl: await this.storage.presignUpload(job.inputKey) };
  }

  /** Step 2: after the upload, verify the file and queue it for processing. */
  async start(userId: string | undefined, id: string): Promise<JobDto> {
    const job = await this.getOwned(userId, id);
    if (job.status !== 'awaiting_upload') throw new HttpError(409, 'already_started', 'Job already started');

    // Trust the stored object, not the size the client claimed at create time.
    const size = await this.storage.size(job.inputKey);
    if (size === null) throw new HttpError(400, 'upload_missing', 'The file has not been uploaded yet');
    const limit = uploadLimit(job.userId ?? undefined);
    if (size > limit) {
      await this.storage.remove(job.inputKey);
      await this.jobs.fail(job.id, 'File too large');
      throw tooLarge(limit);
    }

    // Status change and queue insert commit together: no queued-but-never-processed jobs.
    await inTransaction(this.pool, async (db) => {
      if (!(await this.jobs.transition(job.id, 'awaiting_upload', 'queued', db))) {
        throw new HttpError(409, 'already_started', 'Job already started');
      }
      await this.enqueue(VIDEO_QUEUE, { jobId: job.id }, db);
    });
    return this.toDto({ ...job, status: 'queued' });
  }

  async get(userId: string | undefined, id: string): Promise<JobDto> {
    return this.toDto(await this.getOwned(userId, id));
  }

  async listForUser(userId: string): Promise<JobDto[]> {
    return Promise.all((await this.jobs.listByUser(userId)).map((j) => this.toDto(j)));
  }

  /**
   * Anonymous jobs are reachable by anyone holding the (unguessable) id.
   * A signed-in user's jobs are visible only to that user.
   */
  private async getOwned(userId: string | undefined, id: string): Promise<Job> {
    const job = /^[0-9a-f-]{36}$/i.test(id) ? await this.jobs.findById(id) : null;
    if (!job || (job.userId !== null && job.userId !== userId)) {
      throw new HttpError(404, 'job_not_found', 'Job not found');
    }
    return job;
  }

  private async toDto(job: Job): Promise<JobDto> {
    let downloadUrl: string | null = null;
    if (job.status === 'completed' && job.outputKey) {
      const base = path.parse(job.inputName).name || 'video';
      downloadUrl = await this.storage.presignDownload(
        job.outputKey,
        `${base}-${job.task.operation}.${job.task.params.format}`,
      );
    }
    return {
      id: job.id,
      task: job.task,
      status: job.status,
      progress: job.progress,
      inputName: job.inputName,
      inputSize: job.inputSize,
      outputSize: job.outputSize,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
      downloadUrl,
    };
  }
}
