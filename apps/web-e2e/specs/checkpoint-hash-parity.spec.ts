import { buildCheckpointHash } from '@vers/contract-activity';
import { expect, test } from '../src/test';

const FROZEN_DIGEST = 'c51bad8035095b3d570dd972bd05c7a686b403b2f7db11dbe0fc83e6e9e4150e';

const CANONICAL_JSON = JSON.stringify([
  'hash_0',
  1,
  1,
  'seed_0',
  'seed_1',
  12,
  'tick',
  'server-key',
]);

test('it derives the same frozen digest from the contract call and from browser WebCrypto', async ({
  page,
}) => {
  expect(
    buildCheckpointHash({
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'seed_1',
      prevHash: 'hash_0',
      seed: 'seed_0',
      time: 12,
      type: 'tick',
      version: 1,
    }),
  ).toBe(FROZEN_DIGEST);

  await page.goto('/');

  const browserDigest = await page.evaluate(async (canonical) => {
    const digestBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));

    return [...new Uint8Array(digestBuffer)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }, CANONICAL_JSON);

  expect(browserDigest).toBe(FROZEN_DIGEST);
});
