import { expect, test } from 'bun:test';
import { buildCheckpointHash } from '@vers/contract-activity';
import { ActivityCheckpointType } from '@vers/idle-core';
import { createMockProgressCheckpoint } from '../test-utils/factories/create-mock-progress-checkpoint';
import { createMockStartedCheckpoint } from '../test-utils/factories/create-mock-started-checkpoint';
import { buildCheckpointBatchEntry } from './build-checkpoint-batch-entry';

test('it sets a checkpoint chain position to the activity anchor plus its version', () => {
  const entry = buildCheckpointBatchEntry({
    checkpoint: createMockProgressCheckpoint(),
    entropySource: 'server-key',
    prevHash: 'hash_0',
    previousNextSeed: 'seed_0',
    startChainIndex: 10,
    version: 2,
  });

  expect(entry.payload.chainIndex).toBe(12);
});

test('it places a started checkpoint one position past the activity anchor', () => {
  const entry = buildCheckpointBatchEntry({
    checkpoint: createMockStartedCheckpoint(),
    entropySource: 'server-key',
    prevHash: 'start_hash',
    previousNextSeed: 'seed_0',
    startChainIndex: 10,
    version: 1,
  });

  expect(entry.payload.chainIndex).toBe(11);
});

test('it seeds a started checkpoint entry from the checkpoint own seed', () => {
  const entry = buildCheckpointBatchEntry({
    checkpoint: createMockStartedCheckpoint({ nextSeed: 'seed_0', seed: 'seed_0' }),
    entropySource: 'server-key',
    prevHash: 'start_hash',
    previousNextSeed: 'unrelated_seed',
    startChainIndex: 0,
    version: 1,
  });

  expect(entry.payload.seed).toBe('seed_0');
  expect(entry.payload.nextSeed).toBe(entry.payload.seed);
});

test('it seeds a non-started checkpoint entry from the previous checkpoint next seed', () => {
  const entry = buildCheckpointBatchEntry({
    checkpoint: createMockProgressCheckpoint({ nextSeed: 'seed_1' }),
    entropySource: 'server-key',
    prevHash: 'hash_0',
    previousNextSeed: 'seed_0',
    startChainIndex: 0,
    version: 2,
  });

  expect(entry.payload.seed).toBe('seed_0');
  expect(entry.payload.nextSeed).toBe('seed_1');
});

test('it carries the checkpoint open-record fields into the payload', () => {
  const entry = buildCheckpointBatchEntry({
    checkpoint: createMockProgressCheckpoint({ rewards: { xp: 15 } }),
    entropySource: 'server-key',
    prevHash: 'hash_0',
    previousNextSeed: 'seed_0',
    startChainIndex: 0,
    version: 2,
  });

  expect(entry.payload['rewards']).toStrictEqual({ xp: 15 });
});

test('it computes the entry hash as the canonical hash of its checkpoint fields', () => {
  const entry = buildCheckpointBatchEntry({
    checkpoint: createMockProgressCheckpoint({ nextSeed: 'seed_1', time: 12 }),
    entropySource: 'server-key',
    prevHash: 'hash_0',
    previousNextSeed: 'seed_0',
    startChainIndex: 0,
    version: 2,
  });

  const expectedHash = buildCheckpointHash({
    chainIndex: 2,
    entropySource: 'server-key',
    nextSeed: 'seed_1',
    prevHash: 'hash_0',
    seed: 'seed_0',
    time: 12,
    type: ActivityCheckpointType.Progress,
    version: 2,
  });

  expect(entry.hash).toBe(expectedHash);
});

test('it echoes the input version and previous hash onto the entry', () => {
  const entry = buildCheckpointBatchEntry({
    checkpoint: createMockProgressCheckpoint(),
    entropySource: 'server-key',
    prevHash: 'hash_0',
    previousNextSeed: 'seed_0',
    startChainIndex: 0,
    version: 2,
  });

  expect(entry.version).toBe(2);
  expect(entry.prevHash).toBe('hash_0');
});
