import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BandwidthStore, DEFAULT_BANDWIDTH_BPS } from './bandwidth.ts';
import { playerWindow } from './window.ts';

test('playerWindow: current, then next, then previous', () => {
  assert.deepEqual(playerWindow(2, 5, 3), [2, 3, 1]);
});

test('playerWindow: edges of the feed use the next neighbours instead', () => {
  assert.deepEqual(playerWindow(0, 5, 3), [0, 1, 2]);
  assert.deepEqual(playerWindow(4, 5, 3), [4, 3, 2]);
});

test('playerWindow: short feeds and small pools', () => {
  assert.deepEqual(playerWindow(0, 1, 3), [0]);
  assert.deepEqual(playerWindow(1, 2, 3), [1, 0]);
  assert.deepEqual(playerWindow(2, 5, 1), [2]);
  assert.deepEqual(playerWindow(2, 5, 0), [2], 'there is always a player for the current video');
});

function fakeStorage(initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [['vidcraft:bandwidth:v1', initial]]);
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

test('BandwidthStore: starts from the default, then from what it saved last time', () => {
  assert.equal(new BandwidthStore(fakeStorage()).get(), DEFAULT_BANDWIDTH_BPS);
  assert.equal(new BandwidthStore(fakeStorage('8000000')).get(), 8_000_000);
});

test('BandwidthStore: ignores junk, both stored and measured', () => {
  assert.equal(new BandwidthStore(fakeStorage('banana')).get(), DEFAULT_BANDWIDTH_BPS);
  const store = new BandwidthStore(fakeStorage());
  for (const bad of [0, -5, NaN, Infinity]) store.update(bad);
  assert.equal(store.get(), DEFAULT_BANDWIDTH_BPS);
});

test('BandwidthStore: clamps absurd values', () => {
  const store = new BandwidthStore(fakeStorage());
  store.update(1);
  assert.equal(store.get(), 100_000);
  store.update(1e12);
  assert.equal(store.get(), 50_000_000);
});

test('BandwidthStore: saves at most once per interval', () => {
  const storage = fakeStorage();
  let now = 10_000;
  const store = new BandwidthStore(storage, () => now);
  store.update(3_000_000);
  assert.equal(storage.data.get('vidcraft:bandwidth:v1'), '3000000');
  now += 500;
  store.update(4_000_000);
  assert.equal(store.get(), 4_000_000, 'in-memory value is always current');
  assert.equal(storage.data.get('vidcraft:bandwidth:v1'), '3000000', 'but the write was skipped');
  now += 2000;
  store.update(5_000_000);
  assert.equal(storage.data.get('vidcraft:bandwidth:v1'), '5000000');
});

test('BandwidthStore: survives storage that throws', () => {
  const broken = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('full');
    },
  };
  const store = new BandwidthStore(broken);
  store.update(2_000_000);
  assert.equal(store.get(), 2_000_000);
});

test('BandwidthStore: works with no storage at all', () => {
  const store = new BandwidthStore(null);
  store.update(2_500_000);
  assert.equal(store.get(), 2_500_000);
});
