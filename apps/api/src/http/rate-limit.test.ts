import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import { errorHandler } from './errors.ts';
import { rateLimit } from './rate-limit.ts';

function app(trustProxy: boolean) {
  const a = express();
  if (trustProxy) a.set('trust proxy', 1);
  a.use(rateLimit({ windowMs: 60_000, max: 2 }));
  a.get('/', (_req, res) => res.json({ ok: true }));
  a.use(errorHandler);
  return a;
}
const from = (a: express.Express, ip: string) => request(a).get('/').set('X-Forwarded-For', ip);

test('behind a trusted proxy, visitors are told apart by the address the proxy forwards', async () => {
  const a = app(true);
  assert.equal((await from(a, '203.0.113.1')).status, 200);
  assert.equal((await from(a, '203.0.113.1')).status, 200);
  assert.equal((await from(a, '203.0.113.1')).status, 429, 'the third request from one visitor is limited');
  assert.equal((await from(a, '203.0.113.2')).status, 200, 'a different visitor is unaffected');
});

test('without a trusted proxy, a forwarded address is ignored, so it cannot be used to dodge the limit', async () => {
  const a = app(false);
  assert.equal((await from(a, '203.0.113.1')).status, 200);
  assert.equal((await from(a, '203.0.113.2')).status, 200);
  assert.equal((await from(a, '203.0.113.3')).status, 429, 'faking a new address each time does not help');
});
