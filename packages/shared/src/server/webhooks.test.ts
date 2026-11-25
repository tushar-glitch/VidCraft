import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, test } from 'node:test';
import { assertWebhookUrl, checkWebhookUrl, isPrivateAddress, sendWebhook, sign, signatureHeader, verifySignature, WebhookUrlError } from './webhooks.ts';

const SECRET = 'whsec_test_secret';
const BODY = '{"id":"d1","type":"ping"}';

// ---- signing ----

test('sign matches an independently computed HMAC of "<timestamp>.<body>"', () => {
  const expected = createHmac('sha256', SECRET).update(`1700000000.${BODY}`).digest('hex');
  assert.equal(sign(SECRET, 1_700_000_000, BODY), expected);
  assert.equal(signatureHeader(SECRET, 1_700_000_000, BODY), `t=1700000000,v1=${expected}`);
});

test('verifySignature accepts a genuine request and rejects every kind of tampering', () => {
  const now = 1_700_000_000;
  const header = signatureHeader(SECRET, now, BODY);
  assert.equal(verifySignature(header, BODY, SECRET, 300, now), true);
  assert.equal(verifySignature(header, BODY + ' ', SECRET, 300, now), false, 'changed body');
  assert.equal(verifySignature(header, BODY, 'whsec_other', 300, now), false, 'wrong secret');
  assert.equal(verifySignature(header.replace(/v1=./, 'v1=0'), BODY, SECRET, 300, now), false, 'altered signature');
  assert.equal(verifySignature(`t=${now - 3600},v1=${sign(SECRET, now - 3600, BODY)}`, BODY, SECRET, 300, now), false, 'an hour old: replay');
  assert.equal(verifySignature(`t=${now},v1=abc`, BODY, SECRET, 300, now), false, 'wrong length');
  for (const junk of ['', 'nonsense', 't=,v1=', 'v1=abc', `t=${now}`]) assert.equal(verifySignature(junk, BODY, SECRET, 300, now), false, `junk header "${junk}"`);
});

// ---- addresses a webhook must never call ----

test('isPrivateAddress blocks internal addresses, including the cloud metadata address and IPv4-in-IPv6', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1', '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:10.0.0.1', '::ffff:127.0.0.1', 'not an ip', '']) {
    assert.equal(isPrivateAddress(ip), true, `${ip} should be blocked`);
  }
});

test('isPrivateAddress allows ordinary public addresses', () => {
  for (const ip of ['93.184.216.34', '8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
    assert.equal(isPrivateAddress(ip), false, `${ip} should be allowed`);
  }
});

// ---- URLs ----

const rejects = (url: string, allowPrivate = false) => assert.throws(() => checkWebhookUrl(url, allowPrivate), WebhookUrlError, url);

test('checkWebhookUrl rejects what cannot be a safe public https endpoint', () => {
  rejects('not a url');
  rejects('http://example.com/hook'); // plain http
  rejects('ftp://example.com/hook');
  rejects('https://user:pass@example.com/hook'); // credentials
  rejects('https://127.0.0.1/hook');
  rejects('https://169.254.169.254/latest/meta-data');
  rejects('https://[::1]/hook');
  rejects('https://[::ffff:10.0.0.1]/hook');
  rejects('https://localhost/hook');
  rejects('https://LOCALHOST:8443/hook');
  assert.equal(checkWebhookUrl('https://example.com/hook?x=1', false).hostname, 'example.com');
});

test('checkWebhookUrl lets local development use http and private addresses only when allowed', () => {
  assert.doesNotThrow(() => checkWebhookUrl('http://127.0.0.1:9000/hook', true));
  assert.doesNotThrow(() => checkWebhookUrl('http://localhost:9000/hook', true));
  rejects('ftp://example.com', true);
});

test('assertWebhookUrl checks where the name actually points', async () => {
  const resolvesTo = (...addresses: string[]) => async () => addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
  await assert.doesNotReject(assertWebhookUrl('https://hooks.example.com/x', false, resolvesTo('93.184.216.34')));
  await assert.rejects(assertWebhookUrl('https://evil.example.com/x', false, resolvesTo('127.0.0.1')), /not reachable/);
  await assert.rejects(assertWebhookUrl('https://evil.example.com/x', false, resolvesTo('93.184.216.34', '10.0.0.5')), /not reachable/, 'one private answer is enough to refuse');
  await assert.rejects(assertWebhookUrl('https://nowhere.invalid/x', false, async () => { throw new Error('ENOTFOUND'); }), /Could not find/);
  await assert.doesNotReject(assertWebhookUrl('https://dev.example.com/x', true, resolvesTo('127.0.0.1')), 'allowed in development');
});

// ---- sending, against a real local server ----

type Handler = (req: http.IncomingMessage, res: http.ServerResponse, body: string) => void;
const servers: http.Server[] = [];
after(() => servers.forEach((s) => s.close()));

async function serve(handler: Handler) {
  const received: { headers: http.IncomingHttpHeaders; body: string }[] = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received.push({ headers: req.headers, body });
      handler(req, res, body);
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`, received };
}

const send = (url: string, over: Partial<Parameters<typeof sendWebhook>[0]> = {}) =>
  sendWebhook({ url, secret: SECRET, deliveryId: 'd1', eventType: 'ping', body: BODY, allowPrivate: true, timeoutMs: 1500, ...over });

test('sendWebhook delivers a signed request and reports success', async () => {
  const s = await serve((_req, res) => res.writeHead(200).end('ok'));
  const result = await send(s.url, { nowSec: Math.floor(Date.now() / 1000) });
  assert.deepEqual(result, { ok: true, status: 200, error: null });
  const got = s.received[0]!;
  assert.equal(got.body, BODY);
  assert.equal(got.headers['content-type'], 'application/json');
  assert.equal(got.headers['x-vidcraft-event'], 'ping');
  assert.equal(got.headers['x-vidcraft-delivery'], 'd1');
  assert.equal(verifySignature(got.headers['x-vidcraft-signature'] as string, got.body, SECRET), true, 'the receiver can verify the signature');
});

test('sendWebhook reports a failing receiver with its status', async () => {
  const s = await serve((_req, res) => res.writeHead(500).end('boom'));
  const result = await send(s.url);
  assert.equal(result.ok, false);
  assert.equal(result.status, 500);
  assert.match(result.error!, /500/);
});

test('sendWebhook does not follow redirects, so a redirect cannot lead it somewhere internal', async () => {
  const target = await serve((_req, res) => res.writeHead(200).end());
  const redirector = await serve((_req, res) => res.writeHead(302, { location: target.url }).end());
  const result = await send(redirector.url);
  assert.equal(result.ok, false);
  assert.equal(result.status, 302);
  assert.equal(target.received.length, 0, 'the redirect target was never contacted');
});

test('sendWebhook gives up on a receiver that never answers', async () => {
  const s = await serve(() => {}); // accepts the request and says nothing
  const started = Date.now();
  const result = await send(s.url, { timeoutMs: 300 });
  assert.equal(result.ok, false);
  assert.equal(result.status, null);
  assert.match(result.error!, /Timed out/);
  assert.ok(Date.now() - started < 3000);
});

test('sendWebhook refuses internal addresses unless development mode allows them', async () => {
  const s = await serve((_req, res) => res.writeHead(200).end());
  const result = await send(s.url, { allowPrivate: false });
  assert.equal(result.ok, false);
  assert.equal(s.received.length, 0, 'no request reached the server');
});

test('sendWebhook catches a name that points at an internal address when it connects (DNS rebinding)', async () => {
  const s = await serve((_req, res) => res.writeHead(200).end());
  const port = new URL(s.url).port;
  const rebinding = async () => [{ address: '127.0.0.1', family: 4 }]; // a public-looking name that resolves to localhost
  const blockedResult = await sendWebhook({ url: `https://hooks.example.com:${port}/hook`, secret: SECRET, deliveryId: 'd', eventType: 'ping', body: BODY, allowPrivate: false, resolve: rebinding, timeoutMs: 1500 });
  assert.equal(blockedResult.ok, false);
  assert.match(blockedResult.error!, /Blocked/);
  assert.equal(s.received.length, 0);

  // With development mode on, the same name is allowed to resolve there and the request goes through.
  const allowed = await sendWebhook({ url: `http://hooks.example.com:${port}/hook`, secret: SECRET, deliveryId: 'd', eventType: 'ping', body: BODY, allowPrivate: true, resolve: rebinding, timeoutMs: 1500 });
  assert.equal(allowed.ok, true);
});
