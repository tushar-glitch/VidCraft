import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mean, median, percentile, summarize } from './stats.ts';

test('median: odd count takes the middle, even count averages the middle two, order does not matter', () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([7]), 7);
});

test('percentile is nearest-rank', () => {
  const v = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
  assert.equal(percentile(v, 95), 19, '95% of 20 values: the 19th');
  assert.equal(percentile(v, 50), 10);
  assert.equal(percentile(v, 100), 20);
  assert.equal(percentile(v, 0), 1, 'never below the smallest');
  assert.equal(percentile([42], 95), 42);
});

test('percentile does not change its input', () => {
  const v = [3, 1, 2];
  percentile(v, 50);
  assert.deepEqual(v, [3, 1, 2]);
});

test('a slow tail shows up in p95 but not the median', () => {
  const s = summarize([100, 110, 120, 130, 140, 150, 160, 170, 180, 9000]);
  assert.equal(s.n, 10);
  assert.equal(s.medianMs, 145);
  assert.equal(s.p95Ms, 9000);
});

test('empty input is an error, not NaN', () => {
  assert.throws(() => median([]));
  assert.throws(() => percentile([], 50));
});

test('mean', () => assert.equal(mean([1, 2, 3, 6]), 3));
