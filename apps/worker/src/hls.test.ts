import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { probe, runFfmpeg } from './ffmpeg.ts';
import { buildHlsArgs, buildThumbnailArgs, planRenditions, SEGMENT_SECONDS } from './hls.ts';

test('planRenditions: full ladder for a 1080x1920 vertical video', () => {
  const r = planRenditions(1080, 1920);
  assert.deepEqual(r.map((x) => x.name), ['1080p', '720p', '540p', '360p']);
  assert.deepEqual([r[0]!.width, r[0]!.height], [1080, 1920]);
  assert.deepEqual([r[1]!.width, r[1]!.height], [720, 1280]);
  assert.deepEqual([r[3]!.width, r[3]!.height], [360, 640]);
});

test('planRenditions: landscape is keyed on the short side, and never upscales', () => {
  const r = planRenditions(1280, 720);
  assert.deepEqual(r.map((x) => x.name), ['720p', '540p', '360p']);
  assert.deepEqual([r[2]!.width, r[2]!.height], [640, 360]);
});

test('planRenditions: a tiny source gets one rung at its own size, with even dimensions', () => {
  const r = planRenditions(321, 241);
  assert.equal(r.length, 1);
  assert.deepEqual([r[0]!.width, r[0]!.height], [322, 242]);
});

const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH ?? 'ffprobe';
let hasFfmpeg = true;
try {
  execFileSync(ffmpeg, ['-version'], { stdio: 'ignore' });
} catch {
  hasFfmpeg = false;
}

const dir = mkdtempSync(path.join(os.tmpdir(), 'vidcraft-hls-test-'));
after(() => rmSync(dir, { recursive: true, force: true }));

/** Segment durations listed in a media playlist. */
const extinf = (playlist: string) => [...playlist.matchAll(/#EXTINF:([\d.]+)/g)].map((m) => Number(m[1]));

for (const withAudio of [true, false]) {
  test(`ffmpeg: HLS ladder from a 720x1280 clip ${withAudio ? 'with' : 'without'} audio`, { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
    const name = withAudio ? 'a' : 'v';
    const input = path.join(dir, `${name}.mp4`);
    const audio = withAudio ? ['-f', 'lavfi', '-i', 'sine=duration=7', '-c:a', 'aac'] : ['-an'];
    execFileSync(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=720x1280:rate=30:duration=7', ...audio, '-c:v', 'libx264', '-shortest', input]);

    const source = await probe(ffprobe, input);
    assert.equal(source.hasAudio, withAudio);
    const renditions = planRenditions(source.width, source.height); // 720p, 540p, 360p
    const outDir = path.join(dir, `out-${name}`);
    for (const r of renditions) mkdirSync(path.join(outDir, r.name), { recursive: true });

    const seen: number[] = [];
    await runFfmpeg(ffmpeg, buildHlsArgs({ input, outDir, source, renditions }), source.durationSec, (p) => seen.push(p));
    assert.ok(seen.length > 0, 'progress reported');

    const master = readFileSync(path.join(outDir, 'master.m3u8'), 'utf8');
    for (const r of renditions) {
      assert.match(master, new RegExp(`RESOLUTION=${r.width}x${r.height}`));
      assert.ok(master.includes(`${r.name}/index.m3u8`));
    }
    assert.equal(master.includes('mp4a'), withAudio, 'audio codec listed only when there is audio');

    // Lowest quality first: that is where a player which doesn't choose for itself will start.
    const listed = [...master.matchAll(/RESOLUTION=(\d+)x(\d+)/g)].map((m) => Number(m[2]));
    assert.deepEqual(listed, [...listed].sort((a, b) => a - b), `qualities listed lowest first (${listed.join(', ')})`);
    assert.equal(listed.length, renditions.length);

    // Every quality is cut at the same moments, so a player can switch between them seamlessly.
    const durations = renditions.map((r) => {
      const dirFiles = readdirSync(path.join(outDir, r.name));
      assert.ok(dirFiles.some((f) => /^init_\d+\.mp4$/.test(f)), `${r.name} has an init segment`);
      return extinf(readFileSync(path.join(outDir, r.name, 'index.m3u8'), 'utf8'));
    });
    for (const d of durations) {
      assert.deepEqual(d, durations[0], 'segment boundaries match across qualities');
      assert.ok(d.slice(0, -1).every((s) => Math.abs(s - SEGMENT_SECONDS) < 0.1), `full segments are ~${SEGMENT_SECONDS}s: ${d}`);
    }
  });
}

test('ffmpeg: thumbnail is produced', { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
  const input = path.join(dir, 'a.mp4');
  const thumb = path.join(dir, 'thumb.jpg');
  await runFfmpeg(ffmpeg, buildThumbnailArgs(input, thumb, 7), 0, () => {});
  assert.ok(existsSync(thumb));
  const t = await probe(ffprobe, thumb);
  assert.deepEqual([t.width, t.height], [406, 720]); // 720x1280 scaled to 720px tall (width rounded to even)
});
