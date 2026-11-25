import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Checks that a webhook really came from VidCraft.
 *
 * `rawBody` must be the request body exactly as received (a string), before any JSON parsing:
 * parsing and re-serialising can change it, and then the signature won't match.
 */
export function verifyVidCraftSignature(rawBody, signatureHeader, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries(signatureHeader.split(',').map((part) => part.trim().split('=')));
  const timestamp = Number(parts.t);
  if (!Number.isInteger(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false; // too old: could be a replay

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
  const given = Buffer.from(parts.v1 ?? '', 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected); // constant time
}
