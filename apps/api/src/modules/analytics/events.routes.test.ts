import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import type { PlaybackContext, PlaybackEvent } from '@vidcraft/shared';
import { errorHandler } from '../../http/errors.ts';
import { clampTime, eventsRoutes } from './analytics.routes.ts';

const NOW = new Date('2026-11-24T12:00:00Z');
const VIDEO = '4f0c9a52-2b1e-4d6e-9a53-0d6b6d9a1f10';
const context: PlaybackContext = { sessionId: 'session-12345', network: '4g', device: 'touch', sdk: '0.1.0' };

const firstFrame = (over: Record<string, unknown> = {}) => ({
  type: 'firstFrame',
  itemId: VIDEO,
  viewId: 'view-0001-abcd',
  t: NOW.getTime() - 1000,
  index: 0,
  startupMs: 180,
  preloaded: true,
  quality: 720,
  bandwidthKbps: 5200,
  breakdown: { manifestMs: 0, levelMs: 0, fragmentMs: 0, renderMs: 180 },
  fragmentBytes: 250_000,
  ...over,
});

function setup() {
  const inserted: { context: PlaybackContext; events: { occurredAt: Date; event: PlaybackEvent }[] }[] = [];
  const app = express();
  app.use('/events', eventsRoutes({ insert: async (c, events) => void inserted.push({ context: c, events }) }, () => NOW));
  app.use(errorHandler);
  return { app, inserted };
}

test('accepts a valid batch sent as plain text, the way the SDK sends it', async () => {
  const { app, inserted } = setup();
  const res = await request(app)
    .post('/events')
    .set('Content-Type', 'text/plain;charset=UTF-8') // exactly what the SDK sends
    .send(JSON.stringify({ context, events: [firstFrame(), { type: 'rebuffer', itemId: VIDEO, viewId: 'view-0001-abcd', t: NOW.getTime(), durationMs: 420 }] }));
  assert.equal(res.status, 202);
  assert.deepEqual(res.body, { accepted: 2, rejected: 0 });
  assert.equal(inserted[0]?.events.length, 2);
  assert.deepEqual(inserted[0]?.context, context);
});

test('drops invalid events but keeps the rest of the batch', async () => {
  const { app, inserted } = setup();
  const res = await request(app)
    .post('/events')
    .send(JSON.stringify({ context, events: [firstFrame(), firstFrame({ itemId: 'not-a-uuid' }), firstFrame({ startupMs: -5 }), { type: 'made-up' }, 42, null] }));
  assert.equal(res.status, 202);
  assert.deepEqual(res.body, { accepted: 1, rejected: 5 });
  assert.equal(inserted[0]?.events.length, 1);
});

test('rejects a body that is not JSON, a bad context, or too many events', async () => {
  const { app, inserted } = setup();
  assert.equal((await request(app).post('/events').send('not json')).status, 400);
  assert.equal((await request(app).post('/events')).status, 400, 'empty body');
  assert.equal((await request(app).post('/events').send(JSON.stringify({ context: { ...context, device: 'toaster' }, events: [] }))).status, 400);
  assert.equal((await request(app).post('/events').send(JSON.stringify({ context, events: Array(101).fill(firstFrame()) }))).status, 400);
  assert.equal(inserted.length, 0, 'nothing was stored');
});

test('refuses oversized bodies', async () => {
  const { app } = setup();
  const res = await request(app).post('/events').send('x'.repeat(200_000));
  assert.equal(res.status, 413);
});

test('is open to any website (the SDK runs on other sites)', async () => {
  const { app } = setup();
  const res = await request(app).post('/events').set('Origin', 'https://example.org').send(JSON.stringify({ context, events: [] }));
  assert.equal(res.headers['access-control-allow-origin'], '*');
});

test('clampTime trusts plausible device clocks only', () => {
  assert.equal(clampTime(NOW.getTime() - 60_000, NOW).getTime(), NOW.getTime() - 60_000);
  assert.equal(clampTime(NOW.getTime() - 3 * 86_400_000, NOW).getTime(), NOW.getTime(), 'days in the past → server time');
  assert.equal(clampTime(NOW.getTime() + 3_600_000, NOW).getTime(), NOW.getTime(), 'an hour ahead → server time');
});

test('rate limits one address to 120 requests a minute, then says when to retry', async () => {
  const { app } = setup();
  const body = JSON.stringify({ context, events: [] });
  for (let i = 0; i < 120; i++) assert.equal((await request(app).post('/events').send(body)).status, 202);
  const blocked = await request(app).post('/events').send(body);
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers['retry-after']) > 0);
  assert.equal(blocked.body.error.code, 'rate_limited');
});
