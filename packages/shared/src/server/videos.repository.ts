import type { PublishStatus, RenditionDto, VideoStatus } from '../index.ts';
import type { Queryable } from './jobs.repository.ts';

export interface Video {
  id: string;
  userId: string;
  title: string;
  status: VideoStatus;
  progress: number;
  publishStatus: PublishStatus;
  sourceName: string;
  sourceSize: number;
  sourceKey: string;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  renditions: RenditionDto[];
  hlsKey: string | null;
  thumbnailKey: string | null;
  error: string | null;
  createdAt: Date;
}

interface VideoRow {
  id: string;
  user_id: string;
  title: string;
  status: VideoStatus;
  progress: number;
  publish_status: PublishStatus;
  source_name: string;
  source_size: string; // bigint comes back as a string
  source_key: string;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  renditions: RenditionDto[];
  hls_key: string | null;
  thumbnail_key: string | null;
  error: string | null;
  created_at: Date;
}

const toVideo = (r: VideoRow): Video => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  status: r.status,
  progress: r.progress,
  publishStatus: r.publish_status,
  sourceName: r.source_name,
  sourceSize: Number(r.source_size),
  sourceKey: r.source_key,
  durationSec: r.duration_sec,
  width: r.width,
  height: r.height,
  renditions: r.renditions,
  hlsKey: r.hls_key,
  thumbnailKey: r.thumbnail_key,
  error: r.error,
  createdAt: r.created_at,
});

export interface ReadyInfo {
  durationSec: number;
  width: number;
  height: number;
  renditions: RenditionDto[];
  hlsKey: string;
  thumbnailKey: string;
}

export class VideosRepository {
  constructor(private readonly db: Queryable) {}

  async create(v: Pick<Video, 'id' | 'userId' | 'title' | 'sourceName' | 'sourceSize' | 'sourceKey'>): Promise<Video> {
    const { rows } = await this.db.query<VideoRow>(
      `insert into videos (id, user_id, title, source_name, source_size, source_key)
       values ($1, $2, $3, $4, $5, $6) returning *`,
      [v.id, v.userId, v.title, v.sourceName, v.sourceSize, v.sourceKey],
    );
    return toVideo(rows[0]!);
  }

  async findById(id: string): Promise<Video | null> {
    const { rows } = await this.db.query<VideoRow>('select * from videos where id = $1', [id]);
    return rows[0] ? toVideo(rows[0]) : null;
  }

  async listByUser(userId: string, limit = 100): Promise<Video[]> {
    const { rows } = await this.db.query<VideoRow>(
      'select * from videos where user_id = $1 order by created_at desc limit $2',
      [userId, limit],
    );
    return rows.map(toVideo);
  }

  /**
   * One page of the public feed, newest first. `cursor` is the position of the last item already seen.
   * The position is kept as the database's own timestamp text: a JS Date would round it to milliseconds
   * and could repeat or skip videos uploaded within the same millisecond.
   */
  async listFeed(limit: number, cursor?: { ts: string; id: string }): Promise<{ videos: Video[]; lastCursor: { ts: string; id: string } | null; hasMore: boolean }> {
    const { rows } = await this.db.query<VideoRow & { cursor_ts: string }>(
      `select *, to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_ts
       from videos
       where status = 'ready' and publish_status = 'published'
         and ($1::timestamptz is null or (created_at, id) < ($1::timestamptz, $2::uuid))
       order by created_at desc, id desc
       limit $3`,
      [cursor?.ts ?? null, cursor?.id ?? null, limit + 1],
    );
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      videos: page.map(toVideo),
      lastCursor: last ? { ts: last.cursor_ts, id: last.id } : null,
      hasMore: rows.length > limit,
    };
  }

  /** Returns false if the video was not in `from`, so two callers can't both win a transition. */
  async transition(id: string, from: VideoStatus, to: VideoStatus, db: Queryable = this.db): Promise<boolean> {
    const { rowCount } = await db.query(
      'update videos set status = $3, updated_at = now() where id = $1 and status = $2',
      [id, from, to],
    );
    return rowCount === 1;
  }

  async setProgress(id: string, progress: number): Promise<void> {
    await this.db.query('update videos set progress = $2, updated_at = now() where id = $1', [id, progress]);
  }

  async markReady(id: string, info: ReadyInfo): Promise<void> {
    await this.db.query(
      `update videos set status = 'ready', progress = 100, duration_sec = $2, width = $3, height = $4,
         renditions = $5, hls_key = $6, thumbnail_key = $7, error = null, updated_at = now() where id = $1`,
      [id, info.durationSec, info.width, info.height, JSON.stringify(info.renditions), info.hlsKey, info.thumbnailKey],
    );
  }

  async fail(id: string, error: string): Promise<void> {
    await this.db.query(`update videos set status = 'failed', error = $2, updated_at = now() where id = $1`, [
      id,
      error.slice(0, 1000),
    ]);
  }

  async update(id: string, patch: { title?: string; publishStatus?: PublishStatus }): Promise<void> {
    await this.db.query(
      `update videos set title = coalesce($2, title), publish_status = coalesce($3, publish_status), updated_at = now() where id = $1`,
      [id, patch.title ?? null, patch.publishStatus ?? null],
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.query('delete from videos where id = $1', [id]);
  }
}
