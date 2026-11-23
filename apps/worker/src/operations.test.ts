import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import type { JobTask } from '@vidcraft/shared';
import { parseProgressLine, probe, runFfmpeg } from './ffmpeg.ts';
import { buildFfmpegArgs } from './operations.ts';

test('parseProgressLine maps out_time_us to a 0-99 percentage', () => {
  assert.equal(parseProgressLine('out_time_us=5000000', 10), 50);
  assert.equal(parseProgressLine('out_time_us=99000000', 10), 99); // capped: 100 means "done"
  assert.equal(parseProgressLine('frame=12', 10), null);
  assert.equal(parseProgressLine('out_time_us=5000000', 0), null); // unknown duration
});

// Runs the real ffmpeg arguments on a generated clip, so a bad flag fails here, not in production.
const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH ?? 'ffprobe';
let hasFfmpeg = true;
try {
  execFileSync(ffmpeg, ['-version'], { stdio: 'ignore' });
} catch {
  hasFfmpeg = false;
}

const dir = mkdtempSync(path.join(os.tmpdir(), 'vidcraft-test-'));
after(() => rmSync(dir, { recursive: true, force: true }));

const cases: [string, JobTask, (out: Awaited<ReturnType<typeof probe>>) => void][] = [
  ['compress to 30% (mp4, h264)', { operation: 'compress', params: { targetPercent: 30, format: 'mp4', codec: 'h264' } }, () => {}],
  ['compress to mkv with h265', { operation: 'compress', params: { targetPercent: 50, format: 'mkv', codec: 'h265' } }, () => {}],
  ['resize to odd 321x241 (rounded up to even)', { operation: 'resize', params: { width: 321, height: 241, format: 'mov' } }, (out) => {
    assert.equal(out.width, 322);
    assert.equal(out.height, 242);
  }],
];

for (const [name, task, check] of cases) {
  test(`ffmpeg: ${name}`, { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
    const input = path.join(dir, 'input.mp4');
    execFileSync(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25:duration=2',
      '-f', 'lavfi', '-i', 'sine=duration=2', '-c:v', 'libx264', '-b:v', '2000k', '-c:a', 'aac', '-shortest', input]);
    const source = await probe(ffprobe, input);
    const output = path.join(dir, `out-${task.operation}.${task.params.format}`);

    const seen: number[] = [];
    await runFfmpeg(ffmpeg, buildFfmpegArgs(task, { input, output, source }), source.durationSec, (p) => seen.push(p));

    const result = await probe(ffprobe, output);
    assert.ok(statSync(output).size > 0);
    assert.ok(Math.abs(result.durationSec - 2) < 0.5, `duration ${result.durationSec}`);
    assert.ok(seen.length > 0 && seen.every((p) => p >= 0 && p <= 99), 'progress reported');
    check(result);
  });
}
