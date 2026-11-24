import type { RenditionDto } from '@vidcraft/shared';
import type { ProbeResult } from './ffmpeg.ts';

/** Segment length in seconds. Short segments let a player start and switch quality sooner. */
export const SEGMENT_SECONDS = 2;

/**
 * Quality ladder keyed on the shorter side of the picture, so it suits vertical and
 * landscape video alike. Bitrates are tuned for phone screens.
 */
const LADDER = [
  { short: 1080, kbps: 4500 },
  { short: 720, kbps: 2500 },
  { short: 540, kbps: 1500 },
  { short: 360, kbps: 800 },
] as const;

const even = (n: number) => n + (n % 2); // H.264 needs even dimensions

/** Which qualities to produce. Never upscales; a tiny source gets a single rung at its own size. */
export function planRenditions(width: number, height: number): RenditionDto[] {
  const short = Math.min(width, height);
  const rungs: { short: number; kbps: number }[] = LADDER.filter((r) => r.short <= short);
  if (rungs.length === 0) rungs.push({ short, kbps: 600 });

  return rungs.map((r) => {
    const scale = r.short / short;
    return {
      name: `${r.short}p`,
      width: even(Math.round(width * scale)),
      height: even(Math.round(height * scale)),
      videoKbps: r.kbps,
    };
  });
}

export interface HlsArgsInput {
  input: string;
  /** Folder that receives master.m3u8 and one sub-folder per rendition. */
  outDir: string;
  source: ProbeResult;
  renditions: RenditionDto[];
}

/**
 * One ffmpeg run produces every rendition. Keyframes are forced on the same 2-second grid in
 * all of them, so segments line up across qualities and a player can switch without a glitch.
 */
export function buildHlsArgs({ input, outDir, source, renditions }: HlsArgsInput): string[] {
  const n = renditions.length;
  const out = outDir.replaceAll('\\', '/');

  const filter = [
    `[0:v]split=${n}${renditions.map((_, i) => `[v${i}]`).join('')}`,
    ...renditions.map((r, i) => `[v${i}]scale=${r.width}:${r.height}:flags=bicubic,setsar=1,format=yuv420p[o${i}]`),
  ].join(';');

  const args = ['-i', input, '-filter_complex', filter];
  renditions.forEach((_, i) => args.push('-map', `[o${i}]`));
  if (source.hasAudio) renditions.forEach(() => args.push('-map', '0:a:0'));

  args.push(
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryfast',
    '-sc_threshold', '0',
    '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_SECONDS})`,
  );
  renditions.forEach((r, i) =>
    args.push(
      `-b:v:${i}`, `${r.videoKbps}k`,
      `-maxrate:v:${i}`, `${Math.round(r.videoKbps * 1.07)}k`,
      `-bufsize:v:${i}`, `${r.videoKbps * 2}k`,
    ),
  );
  if (source.hasAudio) args.push('-c:a', 'aac', '-b:a', '128k', '-ac', '2');

  const streamMap = renditions.map((r, i) => `v:${i}${source.hasAudio ? `,a:${i}` : ''},name:${r.name}`).join(' ');
  args.push(
    '-f', 'hls',
    '-hls_time', String(SEGMENT_SECONDS),
    '-hls_playlist_type', 'vod',
    '-hls_flags', 'independent_segments',
    '-hls_segment_type', 'fmp4',
    '-hls_segment_filename', `${out}/%v/seg_%04d.m4s`,
    '-master_pl_name', 'master.m3u8',
    '-var_stream_map', streamMap,
    `${out}/%v/index.m3u8`,
  );
  return args;
}

/** A poster frame, scaled to at most 720px tall, taken just after the start to skip a black first frame. */
export function buildThumbnailArgs(input: string, output: string, durationSec: number): string[] {
  const at = durationSec > 1 ? 0.5 : 0;
  return ['-ss', String(at), '-i', input, '-frames:v', '1', '-vf', "scale=-2:'min(ih,720)'", '-q:v', '3', output];
}
