import { expect, test } from 'bun:test';
import { buildCheckpointHash } from './build-checkpoint-hash';
import { buildCheckpointHashFromEntry } from './build-checkpoint-hash-from-entry';
import type { CheckpointBatchEntry } from './checkpoint-batch-entry-schema';

test('it derives the frozen chain-link hash for a known entry', () => {
  const entry: CheckpointBatchEntry = {
    hash: 'submitted-hash-ignored',
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'seed_1',
      seed: 'seed_0',
      time: 12,
      type: 'tick',
    },
    prevHash: 'hash_0',
    version: 1,
  };

  expect(buildCheckpointHashFromEntry(entry)).toMatchInlineSnapshot(
    `"c51bad8035095b3d570dd972bd05c7a686b403b2f7db11dbe0fc83e6e9e4150e"`,
  );
});

test('it equals a direct buildCheckpointHash over the entry fields', () => {
  const entry: CheckpointBatchEntry = {
    hash: 'submitted-hash-ignored',
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'seed_1',
      seed: 'seed_0',
      time: 12,
      type: 'tick',
    },
    prevHash: 'hash_0',
    version: 1,
  };

  expect(buildCheckpointHashFromEntry(entry)).toBe(
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
  );
});
