import { expect, test } from '@playwright/test';
import { buildCheckpointHash } from '@vers/contract-activity';
import { buildCheckpointBatchEntry } from '@vers/idle-client';
import type { ActivityCheckpoint } from '@vers/idle-core';
import { ActivityCheckpointType } from '@vers/idle-core';

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

/**
 * Proves the engine→wire path: the submission mapper must derive the exact digest
 * `trackActivityProgress` recomputes from the same eight fields, not a lookalike of it.
 */
test('it derives the same hash from the submission mapper as a direct buildCheckpointHash call', () => {
  const checkpoint: ActivityCheckpoint = {
    nextSeed: 'seed_1',
    rewards: { xp: 5 },
    time: 12,
    type: ActivityCheckpointType.Progress,
  };

  const entry = buildCheckpointBatchEntry({
    checkpoint,
    entropySource: 'chain',
    prevHash: 'hash_0',
    previousNextSeed: 'seed_0',
    startChainIndex: 0,
    version: 1,
  });

  const expectedHash = buildCheckpointHash({
    chainIndex: 1,
    entropySource: 'chain',
    nextSeed: 'seed_1',
    prevHash: 'hash_0',
    seed: 'seed_0',
    time: 12,
    type: ActivityCheckpointType.Progress,
    version: 1,
  });

  expect(entry.hash).toBe(expectedHash);
});
