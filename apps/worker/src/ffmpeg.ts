import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  /** Video stream bitrate in bits/s (falls back to the container's overall bitrate). */
  videoBitrate: number;
}

/** Reads basic facts about a video with ffprobe. Arguments are passed as an array: no shell. */
export async function probe(ffprobePath: string, filePath: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync(ffprobePath, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,bit_rate:format=duration,bit_rate',
    '-of', 'json',
    filePath,
  ]);
  const data = JSON.parse(stdout) as {
    streams?: { width?: number; height?: number; bit_rate?: string }[];
    format?: { duration?: string; bit_rate?: string };
  };
  const stream = data.streams?.[0];
  if (!stream?.width || !stream.height) throw new Error('No video stream found in the uploaded file');
  return {
    durationSec: Number(data.format?.duration ?? 0),
    width: stream.width,
    height: stream.height,
    videoBitrate: Number(stream.bit_rate ?? data.format?.bit_rate ?? 0),
  };
}

/**
 * Extracts progress (0-100) from one line of `ffmpeg -progress pipe:1` output,
 * or null if the line isn't a time marker.
 */
export function parseProgressLine(line: string, durationSec: number): number | null {
  const match = /^out_time_us=(\d+)$/.exec(line.trim());
  if (!match || durationSec <= 0) return null;
  const pct = (Number(match[1]) / 1e6 / durationSec) * 100;
  return Math.max(0, Math.min(99, Math.floor(pct))); // 100 is reserved for "uploaded and done"
}

/** Runs ffmpeg, reporting progress as it goes. Rejects with ffmpeg's last stderr lines on failure. */
export function runFfmpeg(
  ffmpegPath: string,
  args: string[],
  durationSec: number,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, ['-hide_banner', '-y', '-progress', 'pipe:1', '-nostats', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderrTail = '';
    let buffered = '';
    proc.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      buffered += chunk;
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';
      for (const line of lines) {
        const pct = parseProgressLine(line, durationSec);
        if (pct !== null) onProgress(pct);
      }
    });
    proc.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderrTail = (stderrTail + chunk).slice(-2000);
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderrTail.trim().split('\n').slice(-3).join(' | ')}`));
    });
  });
}
