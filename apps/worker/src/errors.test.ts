import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { ConversionError, probe, runFfmpeg, userMessage } from './ffmpeg.ts';

const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH ?? 'ffprobe';
let hasFfmpeg = true;
try {
  execFileSync(ffmpeg, ['-version'], { stdio: 'ignore' });
} catch {
  hasFfmpeg = false;
}

const dir = mkdtempSync(path.join(os.tmpdir(), 'vidcraft-secret-dir-'));
after(() => rmSync(dir, { recursive: true, force: true }));

test('userMessage shows a ConversionError, and hides everything else behind a generic message', () => {
  assert.equal(userMessage(new ConversionError('The file could not be read as a video.')), 'The file could not be read as a video.');
  const leaky = new Error('Command failed: ffprobe -v error /srv/vidcraft/tmp/secret/input');
  assert.doesNotMatch(userMessage(leaky), /ffprobe|secret|\/srv/);
  assert.match(userMessage('a string'), /Something went wrong/);
  assert.match(userMessage(undefined), /Something went wrong/);
});

test('a file that is not a video fails with a message free of commands and server paths', { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
  const file = path.join(dir, 'not-a-video.mp4');
  writeFileSync(file, 'this is just text, not a video '.repeat(100));
  await assert.rejects(probe(ffprobe, file), (err: unknown) => {
    assert.ok(err instanceof ConversionError);
    assert.doesNotMatch(err.message, /ffprobe|vidcraft-secret-dir|\\|\//, `message leaks: ${err.message}`);
    assert.ok(err.cause instanceof Error, 'the real cause is kept for the log');
    assert.match(userMessage(err), /could not be read as a video/);
    return true;
  });
});

test('an ffmpeg failure keeps its detail for the log but shows the user a plain message', { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
  const file = path.join(dir, 'garbage.mp4');
  writeFileSync(file, 'garbage '.repeat(200));
  await assert.rejects(runFfmpeg(ffmpeg, ['-i', file, path.join(dir, 'out.mp4')], 0, () => {}), (err: unknown) => {
    assert.ok(err instanceof ConversionError);
    assert.doesNotMatch(err.message, /vidcraft-secret-dir|ffmpeg exited|Invalid data/);
    assert.match((err.cause as Error).message, /ffmpeg exited with code/, 'the detail is in the cause');
    return true;
  });
});
