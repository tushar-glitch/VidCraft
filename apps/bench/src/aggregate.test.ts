import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregate, type SessionResult } from './aggregate.ts';
import { TIMEOUT_MS } from './constants.ts';
import type { Sample } from './harness.ts';

const ok = (startMs: number, quality = 540, stalls = 0, stallMs = 0): Sample => ({ startMs, quality, stalls, stallMs });

test('summarises starts, stalls, quality and data per view', () => {
  const sessions: SessionResult[] = [
    { cold: ok(1000), swipes: [ok(100), ok(200, 540, 1, 800), ok(300), ok(400, 360, 2, 1200)], bytes: 5_000_000 },
    { cold: ok(1200), swipes: [ok(150), ok(250), ok(350), ok(450)], bytes: 3_000_000 },
  ];
  const row = aggregate('3g', 'sdk', sessions);
  assert.equal(row.network, '3g');
  assert.equal(row.impl, 'sdk');
  assert.deepEqual(row.cold, { n: 2, medianMs: 1100, p95Ms: 1200 });
  assert.equal(row.swipe.n, 8);
  assert.equal(row.swipe.medianMs, 275);
  assert.equal(row.stalledShare, 2 / 8);
  assert.equal(row.stallMsMedian, 1000, 'median of 800 and 1200');
  assert.equal(row.timeouts, 0);
  assert.equal(row.megabytesPerView, 0.8, '8 MB over 10 views');
  assert.equal(row.qualityMedian, 540);
});

test('a video that never played counts as the time limit and is reported as a timeout', () => {
  const failed: Sample = { startMs: null, stalls: 0, stallMs: 0, quality: null };
  const row = aggregate('3g', 'naive', [{ cold: ok(900), swipes: [ok(100), failed], bytes: 1_000_000 }]);
  assert.equal(row.timeouts, 1);
  assert.equal(row.swipe.p95Ms, TIMEOUT_MS);
  assert.equal(row.qualityMedian, 540, 'failed videos have no quality and are left out of it');
});

test('no stalls gives a null stall time, not zero', () => {
  const row = aggregate('fast', 'sdk', [{ cold: ok(100), swipes: [ok(50), ok(60)], bytes: 300_000 }]);
  assert.equal(row.stalledShare, 0);
  assert.equal(row.stallMsMedian, null);
});
