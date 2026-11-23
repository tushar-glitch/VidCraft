import type { JobTask, OperationName, ParamsOf, VideoFormat } from '@vidcraft/shared';
import type { ProbeResult } from './ffmpeg.ts';

export interface OperationContext<P> {
  input: string;
  output: string;
  params: P;
  source: ProbeResult;
}

/** One video operation = how to turn its params into ffmpeg arguments. */
export interface Operation<P> {
  buildArgs(ctx: OperationContext<P>): string[];
}

const CONTENT_TYPES: Record<VideoFormat, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
};
export const contentTypeOf = (format: VideoFormat) => CONTENT_TYPES[format];

/** Container flags: fast-start for MP4/MOV so playback can begin before the download finishes. */
function containerArgs(format: VideoFormat, codec: 'h264' | 'h265'): string[] {
  const args: string[] = [];
  if (format !== 'mkv') args.push('-movflags', '+faststart');
  if (codec === 'h265' && format !== 'mkv') args.push('-tag:v', 'hvc1'); // lets Apple devices play HEVC
  return args;
}

const ENCODERS = { h264: 'libx264', h265: 'libx265' } as const;
const even = (n: number) => n + (n % 2); // H.264/H.265 need even dimensions

const compress: Operation<ParamsOf<'compress'>> = {
  buildArgs({ input, output, params, source }) {
    // Unknown source bitrate (some containers omit it): assume a typical 1080p rate.
    const sourceKbps = source.videoBitrate > 0 ? source.videoBitrate / 1000 : 5000;
    const kbps = Math.max(100, Math.round((sourceKbps * params.targetPercent) / 100));
    return [
      '-i', input,
      '-c:v', ENCODERS[params.codec], '-preset', 'veryfast',
      '-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.5)}k`, '-bufsize', `${kbps * 2}k`,
      '-c:a', 'aac', '-b:a', '128k',
      ...containerArgs(params.format, params.codec),
      output,
    ];
  },
};

const resize: Operation<ParamsOf<'resize'>> = {
  buildArgs({ input, output, params }) {
    const w = even(params.width);
    const h = even(params.height);
    return [
      '-i', input,
      '-vf', `scale=${w}:${h},setsar=1`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      ...containerArgs(params.format, 'h264'),
      output,
    ];
  },
};

/** Registry: adding an operation = add it to the shared schema, then add one entry here. */
const OPERATIONS: { [K in OperationName]: Operation<ParamsOf<K>> } = { compress, resize };

export function buildFfmpegArgs(task: JobTask, ctx: Omit<OperationContext<unknown>, 'params'>): string[] {
  const op = OPERATIONS[task.operation] as Operation<JobTask['params']>;
  return op.buildArgs({ ...ctx, params: task.params });
}
