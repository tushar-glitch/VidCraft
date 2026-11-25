import { createHmac, timingSafeEqual } from 'node:crypto';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

// ---- Signing ----

/** `HMAC-SHA256(secret, "<timestamp>.<body>")` as hex. Including the timestamp stops a captured request being replayed later. */
export function sign(secret: string, timestampSec: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestampSec}.${body}`).digest('hex');
}

/** The `X-VidCraft-Signature` header value: `t=<unix seconds>,v1=<hex signature>`. */
export const signatureHeader = (secret: string, timestampSec: number, body: string) => `t=${timestampSec},v1=${sign(secret, timestampSec, body)}`;

/**
 * What a receiving server should do with an incoming request. Pass the RAW body (not re-serialised JSON).
 * Rejects requests older than `toleranceSec`, so a captured request can't be replayed later.
 */
export function verifySignature(header: string, body: string, secret: string, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)): boolean {
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=', 2) as [string, string]));
  const t = Number(parts.t);
  const given = parts.v1;
  if (!Number.isInteger(t) || !given || Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = Buffer.from(sign(secret, t, body), 'hex');
  const actual = Buffer.from(given, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected); // constant-time, so timing doesn't leak the signature
}

// ---- Keeping webhooks away from internal addresses (server-side request forgery) ----

const blocked = new net.BlockList();
for (const cidr of [
  '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24',
  '192.0.2.0/24', '192.168.0.0/16', '198.18.0.0/15', '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4',
]) {
  const [address, prefix] = cidr.split('/') as [string, string];
  blocked.addSubnet(address, Number(prefix), 'ipv4');
}
for (const cidr of ['::/128', '::1/128', 'fc00::/7', 'fe80::/10', 'ff00::/8', '2001:db8::/32', '64:ff9b::/96']) {
  const [address, prefix] = cidr.split('/') as [string, string];
  blocked.addSubnet(address, Number(prefix), 'ipv6');
}

/**
 * True for addresses a webhook must never call: loopback, private networks, link-local (which includes the
 * cloud metadata address 169.254.169.254), multicast and so on. IPv4 addresses written as IPv6 are covered.
 * Anything that isn't a valid address counts as blocked.
 */
export function isPrivateAddress(address: string): boolean {
  const family = net.isIP(address);
  return family === 0 || blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export class WebhookUrlError extends Error {}

type Resolver = (hostname: string) => Promise<{ address: string; family: number }[]>;
const defaultResolver: Resolver = (hostname) => dns.promises.lookup(hostname, { all: true });

/**
 * Checks everything about a URL that can be checked without connecting. Throws WebhookUrlError with a reason a
 * user can act on. `allowPrivate` is for local development only.
 */
export function checkWebhookUrl(raw: string, allowPrivate: boolean): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new WebhookUrlError('That is not a valid URL');
  }
  if (url.protocol !== 'https:' && !(allowPrivate && url.protocol === 'http:')) throw new WebhookUrlError('The URL must start with https://');
  if (url.username || url.password) throw new WebhookUrlError('The URL must not contain a username or password');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  // An address typed straight into the URL is never looked up, so it has to be checked here.
  if (!allowPrivate && net.isIP(host) && isPrivateAddress(host)) throw new WebhookUrlError('That address is not reachable from the internet');
  if (!allowPrivate && host.toLowerCase() === 'localhost') throw new WebhookUrlError('That address is not reachable from the internet');
  return url;
}

/** Early feedback when a webhook is added: the name must resolve, and only to public addresses. */
export async function assertWebhookUrl(raw: string, allowPrivate: boolean, resolve: Resolver = defaultResolver): Promise<void> {
  const url = checkWebhookUrl(raw, allowPrivate);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) return;
  let addresses: { address: string }[];
  try {
    addresses = await resolve(host);
  } catch {
    throw new WebhookUrlError(`Could not find ${host}`);
  }
  if (!allowPrivate && addresses.some((a) => isPrivateAddress(a.address))) throw new WebhookUrlError('That address is not reachable from the internet');
}

/**
 * A DNS lookup that refuses private addresses. It runs at connection time, on the address that is actually
 * about to be used, so a name that resolved to a public address earlier but a private one now (DNS rebinding)
 * is still caught.
 */
export function guardedLookup(allowPrivate: boolean, resolve: Resolver = defaultResolver): net.LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname).then(
      (addresses) => {
        if (!allowPrivate && addresses.some((a) => isPrivateAddress(a.address))) {
          return callback(new WebhookUrlError('Blocked: that address is not reachable from the internet') as NodeJS.ErrnoException, '', 4);
        }
        const first = addresses[0];
        if (!first) return callback(new WebhookUrlError(`Could not find ${hostname}`) as NodeJS.ErrnoException, '', 4);
        // Newer Node versions ask for every address; older ones for one.
        if ((options as { all?: boolean }).all) (callback as unknown as (e: null, a: typeof addresses) => void)(null, addresses);
        else callback(null, first.address, first.family);
      },
      (err: NodeJS.ErrnoException) => callback(err, '', 4),
    );
  };
}

// ---- Sending ----

export interface WebhookRequest {
  url: string;
  secret: string;
  deliveryId: string;
  eventType: string;
  body: string;
  allowPrivate: boolean;
  timeoutMs?: number;
  nowSec?: number;
  resolve?: Resolver;
}

export interface SendResult {
  ok: boolean;
  /** HTTP status of the response, or null if there was no response. */
  status: number | null;
  error: string | null;
}

/** POSTs a signed webhook. Never follows redirects, gives up after `timeoutMs`, and ignores the response body. */
export function sendWebhook(req: WebhookRequest): Promise<SendResult> {
  return new Promise((resolve) => {
    let url: URL;
    try {
      url = checkWebhookUrl(req.url, req.allowPrivate);
    } catch (err) {
      return resolve({ ok: false, status: null, error: (err as Error).message });
    }
    const timestamp = req.nowSec ?? Math.floor(Date.now() / 1000);
    const request = (url.protocol === 'https:' ? https : http).request(
      url,
      {
        method: 'POST',
        lookup: guardedLookup(req.allowPrivate, req.resolve),
        timeout: req.timeoutMs ?? 10_000,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(req.body),
          'user-agent': 'VidCraft-Webhooks/1',
          'x-vidcraft-event': req.eventType,
          'x-vidcraft-delivery': req.deliveryId,
          'x-vidcraft-signature': signatureHeader(req.secret, timestamp, req.body),
        },
      },
      (res) => {
        res.resume(); // we don't need the answer's body, only its status
        const status = res.statusCode ?? 0;
        resolve({ ok: status >= 200 && status < 300, status, error: status >= 200 && status < 300 ? null : `Your server answered ${status}` });
      },
    );
    request.on('timeout', () => request.destroy(new Error('Timed out waiting for your server')));
    request.on('error', (err) => resolve({ ok: false, status: null, error: err.message.slice(0, 300) }));
    request.end(req.body);
  });
}
