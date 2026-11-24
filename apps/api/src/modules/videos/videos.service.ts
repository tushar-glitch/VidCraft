import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type pg from 'pg';
import { UPLOAD_LIMITS, type CreateVideoRequest, type CreateVideoResponse, type UpdateVideoRequest, type VideoDto } from '@vidcraft/shared';
import { HLS_QUEUE, type ObjectStorage, type Video, type VideosRepository } from '@vidcraft/shared/server';
import { inTransaction, type Enqueue } from '../../db.ts';
import { HttpError } from '../../http/errors.ts';

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const aspectRatio = (w: number, h: number) => `${w / gcd(w, h)}:${h / gcd(w, h)}`;

const limit = UPLOAD_LIMITS.user;
const tooLarge = () => new HttpError(413, 'file_too_large', `File is larger than ${limit / 1024 / 1024} MB`, { limitBytes: limit });

/** The video library: upload, convert to streaming format, publish. Every video belongs to one user. */
export class VideosService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly videos: VideosRepository,
    /** Private bucket for originals. */
    private readonly storage: ObjectStorage,
    /** Public bucket for the streamable files. */
    private readonly media: ObjectStorage,
    private readonly mediaUrl: (key: string) => string,
    private readonly enqueue: Enqueue,
  ) {}

  /** Step 1: record the video and hand back a URL the browser uploads the original to. */
  async create(userId: string, req: CreateVideoRequest): Promise<CreateVideoResponse> {
    if (req.fileSize > limit) throw tooLarge();
    const id = randomUUID();
    const ext = path.extname(req.fileName).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10);
    const video = await this.videos.create({
      id,
      userId,
      title: req.title,
      sourceName: req.fileName,
      sourceSize: req.fileSize,
      sourceKey: `videos/${id}/source${ext}`,
    });
    return { video: this.toDto(video), uploadUrl: await this.storage.presignUpload(video.sourceKey) };
  }

  /** Step 2: after the upload, verify the file and queue it for conversion. */
  async start(userId: string, id: string): Promise<VideoDto> {
    const video = await this.getOwned(userId, id);
    if (video.status !== 'awaiting_upload') throw new HttpError(409, 'already_started', 'Video already started');

    const size = await this.storage.size(video.sourceKey);
    if (size === null) throw new HttpError(400, 'upload_missing', 'The file has not been uploaded yet');
    if (size > limit) {
      await this.storage.remove(video.sourceKey);
      await this.videos.fail(video.id, 'File too large');
      throw tooLarge();
    }

    await inTransaction(this.pool, async (db) => {
      if (!(await this.videos.transition(video.id, 'awaiting_upload', 'queued', db))) {
        throw new HttpError(409, 'already_started', 'Video already started');
      }
      await this.enqueue(HLS_QUEUE, { videoId: video.id }, db);
    });
    return this.toDto({ ...video, status: 'queued' });
  }

  async get(userId: string, id: string): Promise<VideoDto> {
    return this.toDto(await this.getOwned(userId, id));
  }

  async list(userId: string): Promise<VideoDto[]> {
    return (await this.videos.listByUser(userId)).map((v) => this.toDto(v));
  }

  async update(userId: string, id: string, patch: UpdateVideoRequest): Promise<VideoDto> {
    const video = await this.getOwned(userId, id);
    await this.videos.update(video.id, patch);
    return this.toDto({ ...video, ...(patch.title && { title: patch.title }), ...(patch.publishStatus && { publishStatus: patch.publishStatus }) });
  }

  /** Removes the row and every file. Deleting while the worker is converting is not allowed. */
  async remove(userId: string, id: string): Promise<void> {
    const video = await this.getOwned(userId, id);
    if (video.status === 'queued' || video.status === 'processing') {
      throw new HttpError(409, 'video_busy', 'This video is still processing. Try again when it finishes.');
    }
    await this.media.removePrefix(`hls/${video.id}/`);
    await this.storage.remove(video.sourceKey); // no-op once the original has been cleaned up
    await this.videos.delete(video.id);
  }

  private async getOwned(userId: string, id: string): Promise<Video> {
    const video = /^[0-9a-f-]{36}$/i.test(id) ? await this.videos.findById(id) : null;
    // Someone else's video looks exactly like one that doesn't exist.
    if (!video || video.userId !== userId) throw new HttpError(404, 'video_not_found', 'Video not found');
    return video;
  }

  private toDto(v: Video): VideoDto {
    const ready = v.status === 'ready';
    return {
      id: v.id,
      title: v.title,
      status: v.status,
      progress: v.progress,
      publishStatus: v.publishStatus,
      sourceName: v.sourceName,
      sourceSize: v.sourceSize,
      durationSec: v.durationSec,
      width: v.width,
      height: v.height,
      aspectRatio: v.width && v.height ? aspectRatio(v.width, v.height) : null,
      renditions: v.renditions,
      streamingUrl: ready && v.hlsKey ? this.mediaUrl(v.hlsKey) : null,
      thumbnailUrl: ready && v.thumbnailKey ? this.mediaUrl(v.thumbnailKey) : null,
      error: v.error,
      createdAt: v.createdAt.toISOString(),
    };
  }
}
