import { expect, test } from '@playwright/test';
import { buildCheckpointHash } from '@vers/contract-activity';

const FROZEN_DIGEST = 'a2a741f37fd2cffb06c6b5e1ad737106670c1203d89206040b5260de4b632408';
const CANONICAL_JSON = JSON.stringify(['hash_0', 1, 1, 'seed_0', 'seed_1', 12, 'tick', 'chain']);

/**
 * Every party on the checkpoint hash chain — service, verifier, browser client — must derive
 * byte-identical digests. This asserts the Node-context contract call and a real browser's
 * WebCrypto both derive the frozen digest from the same canonical bytes.
 */
test('it derives the same frozen digest from the contract call and from browser WebCrypto', async ({
  page,
}) => {
  expect(
    buildCheckpointHash({
      chainIndex: 1,
      entropySource: 'chain',
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
