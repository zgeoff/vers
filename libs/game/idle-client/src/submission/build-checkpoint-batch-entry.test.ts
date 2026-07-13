import { expect, test } from 'bun:test';
import { buildCheckpointHash } from '@vers/contract-activity';
import type { ActivityCheckpoint } from '@vers/idle-core';
import { ActivityCheckpointType } from '@vers/idle-core';
import { buildCheckpointBatchEntry } from './build-checkpoint-batch-entry';

const startedCheckpoint: ActivityCheckpoint = {
  nextSeed: 'seed_0',
  rewards: { xp: 0 },
  seed: 'seed_0',
  time: 0,
  type: ActivityCheckpointType.Started,
};

const progressCheckpoint: ActivityCheckpoint = {
  nextSeed: 'seed_1',
  rewards: { xp: 15 },
  time: 12,
  type: ActivityCheckpointType.Progress,
};

test('it sets chainIndex to startChainIndex + version', () => {
  const entry = buildCheckpointBatchEntry({
    checkpoint: progressCheckpoint,
    entropySource: 'chain',
    prevHash: 'hash_0',
    previousNextSeed: 'seed_0',
    startChainIndex: 10,
    version: 2,
  });

  expect(entry.payload.chainIndex).toBe(12);
});

test('it sets a Started checkpoint at startChainIndex + 1', () => {
  const entry = buildCheckpointBatchEntry({
    checkpoint: startedCheckpoint,
    entropySource: 'chain',
    prevHash: 'start_hash',
    previousNextSeed: 'seed_0',
    startChainIndex: 10,
    version: 1,
  });

  expect(entry.payload.chainIndex).toBe(11);
});

test('it sets a Started checkpoint payload seed to the checkpoint own seed', () => {
  const entry = buildCheckpointBatchEntry({
    checkpoint: startedCheckpoint,
    entropySource: 'chain',
    prevHash: 'start_hash',
    previousNextSeed: 'unrelated_seed',
    startChainIndex: 0,
    version: 1,
  });

  expect(entry.payload.seed).toBe('seed_0');
  expect(entry.payload.nextSeed).toBe(entry.payload.seed);
});

test('it sets a non-Started checkpoint payload seed to the previous checkpoint nextSeed', () => {
  const entry = buildCheckpointBatchEntry({
    checkpoint: progressCheckpoint,
    entropySource: 'chain',
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
    checkpoint: progressCheckpoint,
    entropySource: 'chain',
    prevHash: 'hash_0',
    previousNextSeed: 'seed_0',
    startChainIndex: 0,
    version: 2,
  });

  expect(entry.payload['rewards']).toStrictEqual({ xp: 15 });
});

test('it derives a hash identical to a direct buildCheckpointHash call over the same fields', () => {
  const entry = buildCheckpointBatchEntry({
    checkpoint: progressCheckpoint,
    entropySource: 'chain',
    prevHash: 'hash_0',
    previousNextSeed: 'seed_0',
    startChainIndex: 0,
    version: 2,
  });

  const expectedHash = buildCheckpointHash({
    chainIndex: 2,
    entropySource: 'chain',
    nextSeed: 'seed_1',
    prevHash: 'hash_0',
    seed: 'seed_0',
    time: 12,
    type: ActivityCheckpointType.Progress,
    version: 2,
  });

  expect(entry.hash).toBe(expectedHash);
});

test('it passes version and prevHash through to the entry unchanged', () => {
  const entry = buildCheckpointBatchEntry({
    checkpoint: progressCheckpoint,
    entropySource: 'chain',
    prevHash: 'hash_0',
    previousNextSeed: 'seed_0',
    startChainIndex: 0,
    version: 2,
  });

  expect(entry.version).toBe(2);
  expect(entry.prevHash).toBe('hash_0');
});
