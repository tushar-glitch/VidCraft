import assert from 'node:assert/strict';
import { test } from 'node:test';
import { playbackBatchSchema, playbackEventSchema } from '@vidcraft/shared';
import { startupBreakdown } from './breakdown.ts';
import { newId, Telemetry, type Send } from './telemetry.ts';
import type { FeedEvent, TelemetryContext } from './types.ts';

const VIDEO = '4f0c9a52-2b1e-4d6e-9a53-0d6b6d9a1f10';
const context: TelemetryContext = { sessionId: 'session-12345', network: '4g', device: 'touch', sdk: '0.1.0' };

// ---- startupBreakdown ----

test('breakdown: a cold start is split into the stages the viewer waited through', () => {
  // assigned and activated together; manifest at 40, level at 70, first piece at 220, picture at 400
  const b = startupBreakdown({ assignedAt: 1000, manifestAt: 1040, levelAt: 1070, fragAt: 1220 }, 1000, 1400);
  assert.deepEqual(b, { manifestMs: 40, levelMs: 30, fragmentMs: 150, renderMs: 180 });
});

test('breakdown: a fully preloaded start is all render time', () => {
  // everything finished long before the viewer got to the video
  const b = startupBreakdown({ assignedAt: -2000, manifestAt: -1950, levelAt: -1900, fragAt: -1700 }, 0, 150);
  assert.deepEqual(b, { manifestMs: 0, levelMs: 0, fragmentMs: 0, renderMs: 150 });
});

test('breakdown: a stage that straddles the moment of activation only counts the part after it', () => {
  const b = startupBreakdown({ assignedAt: -50, manifestAt: -20, levelAt: 10, fragAt: 100 }, 0, 160);
  assert.deepEqual(b, { manifestMs: 0, levelMs: 10, fragmentMs: 90, renderMs: 60 });
});

test('breakdown: missing marks fall through to render, and the parts still add up to the total', () => {
  const b = startupBreakdown({ assignedAt: 0 }, 0, 300);
  assert.deepEqual(b, { manifestMs: 0, levelMs: 0, fragmentMs: 0, renderMs: 300 });
  for (const marks of [{ assignedAt: 0, manifestAt: 50 }, { assignedAt: 0, manifestAt: 50, levelAt: 90, fragAt: 5000 }]) {
    const x = startupBreakdown(marks, 0, 300);
    assert.equal(x.manifestMs + x.levelMs + x.fragmentMs + x.renderMs, 300);
  }
});

test('newId makes distinct ids long enough for the server', () => {
  const ids = new Set(Array.from({ length: 500 }, newId));
  assert.equal(ids.size, 500);
  assert.match([...ids][0]!, /^[0-9a-f]{24}$/);
});

// ---- Telemetry ----

const impression = (n: number): FeedEvent => ({ t: 1_700_000_000_000 + n, viewId: `view-${String(n).padStart(8, '0')}`, type: 'impression', itemId: VIDEO, index: n });

/** A sender that records what it was given and answers as told. */
function fakeSend(result: boolean | 'hang' = true) {
  const calls: { body: string; unloading: boolean }[] = [];
  const send: Send = (_url, body, unloading) => {
    calls.push({ body, unloading });
    return result === 'hang' ? new Promise(() => {}) : Promise.resolve(result);
  };
  return { calls, send };
}
const parsed = (body: string) => JSON.parse(body) as { context: TelemetryContext; events: FeedEvent[] };

test('Telemetry: batches events and sends them with the context', async () => {
  const { calls, send } = fakeSend();
  const t = new Telemetry('http://x/events', () => context, send, 60_000);
  t.track(impression(1));
  t.track(impression(2));
  assert.equal(calls.length, 0, 'nothing is sent per event');
  await t.flush();
  assert.equal(calls.length, 1);
  const batch = parsed(calls[0]!.body);
  assert.deepEqual(batch.context, context);
  assert.equal(batch.events.length, 2);
  t.destroy();
});

test('Telemetry: sends early once 20 events are waiting', async () => {
  const { calls, send } = fakeSend();
  const t = new Telemetry('http://x/events', () => context, send, 60_000);
  for (let i = 0; i < 20; i++) t.track(impression(i));
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 1);
  assert.equal(parsed(calls[0]!.body).events.length, 20);
  t.destroy();
});

test('Telemetry: a failed send is retried with the same events; a send at unload is not retried', async () => {
  const failing = fakeSend(false);
  const t = new Telemetry('http://x/events', () => context, failing.send, 60_000);
  t.track(impression(1));
  await t.flush();
  await t.flush();
  assert.equal(failing.calls.length, 2, 'retried');
  assert.deepEqual(parsed(failing.calls[1]!.body).events, parsed(failing.calls[0]!.body).events, 'same events');
  await t.flush(true);
  await t.flush(true);
  assert.equal(failing.calls.length, 3, 'after a failed unload send the events are gone');
  t.destroy();
});

test('Telemetry: keeps only the newest 200 events if the server is unreachable, and sends at most 100 per request', async () => {
  const { calls, send } = fakeSend('hang'); // the first flush never completes, so events pile up behind it
  const t = new Telemetry('http://x/events', () => context, send, 60_000);
  for (let i = 0; i < 300; i++) t.track(impression(i));
  t.destroy(); // unload flush ignores the hung request
  const last = parsed(calls.at(-1)!.body);
  assert.equal(calls.at(-1)!.unloading, true);
  assert.ok(last.events.length <= 100, `at most 100 per request (${last.events.length})`);
  assert.equal(last.events.at(0)!.type, 'impression');
  assert.ok((last.events.at(0) as { index: number }).index >= 100, 'old events were dropped, not new ones');
});

test('contract: what the SDK sends passes the server schema, for every event type', async () => {
  const base = { t: 1_700_000_000_000, viewId: 'view-0000abcd', itemId: VIDEO };
  const events: FeedEvent[] = [
    { ...base, type: 'impression', index: 3 },
    {
      ...base,
      type: 'firstFrame',
      index: 3,
      startupMs: 182,
      preloaded: true,
      quality: 720,
      bandwidthKbps: 8400,
      breakdown: { manifestMs: 0, levelMs: 0, fragmentMs: 0, renderMs: 182 },
      fragmentBytes: 240_000,
    },
    { ...base, type: 'firstFrame', index: 0, startupMs: 900, preloaded: false, quality: null, bandwidthKbps: null, breakdown: { manifestMs: 40, levelMs: 30, fragmentMs: 500, renderMs: 330 }, fragmentBytes: null },
    { ...base, type: 'rebuffer', durationMs: 640 },
    { ...base, type: 'qualityChange', from: null, to: 540 },
    { ...base, type: 'qualityChange', from: 540, to: 720 },
    { ...base, type: 'viewEnd', index: 3, watchTimeMs: 7300, completed: true },
    { ...base, type: 'error', message: 'networkError: manifestLoadError' },
  ];
  const { calls, send } = fakeSend();
  const t = new Telemetry('http://x/events', () => context, send, 60_000);
  events.forEach((e) => t.track(e));
  await t.flush();
  t.destroy();

  const body = JSON.parse(calls[0]!.body);
  const batch = playbackBatchSchema.parse(body);
  assert.equal(batch.events.length, events.length);
  for (const e of batch.events) {
    const result = playbackEventSchema.safeParse(e);
    assert.ok(result.success, `${(e as { type: string }).type}: ${result.success ? '' : result.error.message}`);
  }
});
