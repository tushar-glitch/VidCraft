import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Logger, ObjectStorage, VideosRepository } from '@vidcraft/shared/server';
import { probe, runFfmpeg } from './ffmpeg.ts';
import { buildHlsArgs, buildThumbnailArgs, planRenditions } from './hls.ts';

export interface HlsProcessorDeps {
  videos: VideosRepository;
  /** Private bucket holding the uploaded originals. */
  storage: ObjectStorage;
  /** Public bucket the player reads from. */
  media: ObjectStorage;
  logger: Logger;
  ffmpegPath: string;
  ffprobePath: string;
}

const CONTENT_TYPES: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.m4s': 'video/iso.segment',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
};
// Finished VOD files never change, so browsers and CDNs may cache them for good.
const IMMUTABLE = 'public, max-age=31536000, immutable';

/** Lists every file under `dir` as paths relative to it, using "/" separators. */
async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(path.join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listFiles(dir, rel)));
    else files.push(rel);
  }
  return files;
}

/** Runs `task` over `items`, at most `limit` at a time. */
async function inBatches<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += limit) await Promise.all(items.slice(i, i + limit).map(task));
}

/** Download → probe → one ffmpeg run for every quality → upload to the public bucket → mark ready. */
export function createHlsProcessor({ videos, storage, media, logger, ffmpegPath, ffprobePath }: HlsProcessorDeps) {
  return async function processHls({ videoId, isLastAttempt }: { videoId: string; isLastAttempt: boolean }): Promise<void> {
    const log = logger.child({ videoId });
    const video = await videos.findById(videoId);
    if (!video) return log.warn('Video no longer exists; skipping');
    if (video.status === 'ready') return log.info('Video already processed; skipping');

    if (video.status === 'queued') await videos.transition(video.id, 'queued', 'processing');
    await videos.setProgress(video.id, 0);

    const dir = await mkdtemp(path.join(os.tmpdir(), `vidcraft-hls-${video.id}-`));
    const prefix = `hls/${video.id}`;
    try {
      const input = path.join(dir, 'input');
      const outDir = path.join(dir, 'out');

      await storage.downloadToFile(video.sourceKey, input);
      const source = await probe(ffprobePath, input);
      const renditions = planRenditions(source.width, source.height);
      log.info({ source, renditions: renditions.map((r) => r.name) }, 'Transcoding to HLS');

      // ffmpeg writes one sub-folder per quality; make sure they exist first.
      await Promise.all(renditions.map((r) => mkdir(path.join(outDir, r.name), { recursive: true })));

      // Encoding is ~90% of the work; the rest is uploading.
      let lastSaved = -1;
      let saving = Promise.resolve();
      await runFfmpeg(ffmpegPath, buildHlsArgs({ input, outDir, source, renditions }), source.durationSec, (pct) => {
        const scaled = Math.floor(pct * 0.9);
        if (scaled < lastSaved + 5) return;
        lastSaved = scaled;
        saving = saving.then(() => videos.setProgress(video.id, scaled)).catch((err) => log.warn({ err }, 'Progress update failed'));
      });
      await saving;

      await runFfmpeg(ffmpegPath, buildThumbnailArgs(input, path.join(outDir, 'thumb.jpg'), source.durationSec), 0, () => {});

      // Segments first, playlists last: nothing in the bucket points at a file that isn't there yet.
      const files = await listFiles(outDir);
      const isPlaylist = (f: string) => f.endsWith('.m3u8');
      const upload = (f: string) =>
        media.uploadFile(`${prefix}/${f}`, path.join(outDir, f), CONTENT_TYPES[path.extname(f)] ?? 'application/octet-stream', IMMUTABLE);
      await inBatches(files.filter((f) => !isPlaylist(f)), 6, upload);
      await videos.setProgress(video.id, 97);
      await inBatches(files.filter((f) => isPlaylist(f) && f !== 'master.m3u8'), 6, upload);
      await upload('master.m3u8');

      await videos.markReady(video.id, {
        durationSec: source.durationSec,
        width: source.width,
        height: source.height,
        renditions,
        hlsKey: `${prefix}/master.m3u8`,
        thumbnailKey: `${prefix}/thumb.jpg`,
      });
      await storage.remove(video.sourceKey); // the original isn't kept once converted
      log.info('Ready');
    } catch (err) {
      log.error({ err, isLastAttempt }, 'HLS processing failed');
      if (isLastAttempt) {
        await videos.fail(video.id, err instanceof Error ? err.message : String(err));
        await media.removePrefix(prefix).catch(() => {}); // don't leave half-uploaded files behind
      }
      throw err; // lets the queue schedule a retry
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
}
