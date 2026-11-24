import type { FeedItemDto, FeedPageDto } from '@vidcraft/shared';
import type { VideosRepository } from '@vidcraft/shared/server';
import { HttpError } from '../../http/errors.ts';

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

// Cursors are opaque to clients: base64url of "<timestamp>|<id>".
const encodeCursor = (c: { ts: string; id: string }) => Buffer.from(`${c.ts}|${c.id}`).toString('base64url');

function decodeCursor(raw: string): { ts: string; id: string } {
  const [ts, id] = Buffer.from(raw, 'base64url').toString().split('|');
  const valid = ts && id && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(ts) && /^[0-9a-f-]{36}$/i.test(id);
  if (!valid) throw new HttpError(400, 'invalid_cursor', 'Invalid cursor');
  return { ts, id };
}

/** The public feed: every video that is ready and published, newest first. */
export class FeedService {
  constructor(
    private readonly videos: VideosRepository,
    private readonly mediaUrl: (key: string) => string,
  ) {}

  async page(limit: number, cursor?: string): Promise<FeedPageDto> {
    const { videos, lastCursor, hasMore } = await this.videos.listFeed(limit, cursor ? decodeCursor(cursor) : undefined);
    const items: FeedItemDto[] = [];
    for (const v of videos) {
      // The query only returns ready videos, which always have these; skip rather than crash if one is ever missing.
      if (!v.hlsKey || !v.thumbnailKey || !v.durationSec || !v.width || !v.height) continue;
      items.push({
        id: v.id,
        title: v.title,
        streamingUrl: this.mediaUrl(v.hlsKey),
        thumbnailUrl: this.mediaUrl(v.thumbnailKey),
        durationSec: v.durationSec,
        width: v.width,
        height: v.height,
        aspectRatio: `${v.width / gcd(v.width, v.height)}:${v.height / gcd(v.width, v.height)}`,
      });
    }
    return { items, nextCursor: hasMore && lastCursor ? encodeCursor(lastCursor) : null };
  }
}
