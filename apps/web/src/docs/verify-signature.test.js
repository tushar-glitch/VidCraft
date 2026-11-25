// Tests the exact code the docs page shows to webhook receivers, against signatures made by the server.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signatureHeader } from '@vidcraft/shared/server';
import { verifyVidCraftSignature } from './verify-signature.js';

const SECRET = 'whsec_docs_example';
const BODY = '{"id":"d1","type":"video.ready","data":{"videoId":"v1"}}';
const now = () => Math.floor(Date.now() / 1000);

test('accepts what the server signs', () => {
  assert.equal(verifyVidCraftSignature(BODY, signatureHeader(SECRET, now(), BODY), SECRET), true);
});

test('rejects a changed body, a wrong secret, an old request and junk', () => {
  const header = signatureHeader(SECRET, now(), BODY);
  assert.equal(verifyVidCraftSignature(BODY.replace('v1', 'v2'), header, SECRET), false);
  assert.equal(verifyVidCraftSignature(BODY, header, 'whsec_other'), false);
  assert.equal(verifyVidCraftSignature(BODY, signatureHeader(SECRET, now() - 3600, BODY), SECRET), false);
  assert.equal(verifyVidCraftSignature(BODY, 't=abc,v1=00', SECRET), false);
  assert.equal(verifyVidCraftSignature(BODY, '', SECRET), false);
});
