import { expect, test } from 'bun:test';
import { buildCheckpointHash } from '@vers/contract-activity';
import { compareReplaySegment } from './compare-replay-segment';
import type { StoredCheckpoint } from './types';

test('it matches when the replay reproduces every stored checkpoint byte-for-byte', () => {
  const seed = 'aa'.repeat(16);
  const nextSeed = 'bb'.repeat(16);
  const replayed = [{ nextSeed, rewards: { xp: 0 }, seed, time: 0, type: 'started' }];

  const hash = buildCheckpointHash({
    chainIndex: 1,
    entropySource: 'server-key',
    nextSeed,
    prevHash: 'root-hash',
    seed,
    time: 0,
    type: 'started',
    version: 1,
  });

  const stored: Array<StoredCheckpoint> = [
    {
      hash,
      payload: {
        chainIndex: 1,
        entropySource: 'server-key',
        nextSeed,
        rewards: { xp: 0 },
        seed,
        time: 0,
        type: 'started',
      },
      prevHash: 'root-hash',
      version: 1,
    },
  ];

  const verdict = compareReplaySegment(stored, replayed, {
    prevHash: 'root-hash',
    seed,
    startChainIndex: 0,
  });

  expect(verdict).toStrictEqual({ kind: 'match', rewardFacts: [], verifiedXPDelta: 0 });
});

test('it computes the verified xp delta from a terminal checkpoint', () => {
  const seed = 'aa'.repeat(16);
  const nextSeed = 'bb'.repeat(16);
  const replayed = [{ nextSeed, rewards: { xp: 215 }, seed, time: 0, type: 'completed' }];

  const hash = buildCheckpointHash({
    chainIndex: 1,
    entropySource: 'server-key',
    nextSeed,
    prevHash: 'root-hash',
    seed,
    time: 0,
    type: 'completed',
    version: 1,
  });

  const stored: Array<StoredCheckpoint> = [
    {
      hash,
      payload: {
        chainIndex: 1,
        entropySource: 'server-key',
        nextSeed,
        rewards: { xp: 215 },
        seed,
        time: 0,
        type: 'completed',
      },
      prevHash: 'root-hash',
      version: 1,
    },
  ];

  const verdict = compareReplaySegment(stored, replayed, {
    prevHash: 'root-hash',
    seed,
    startChainIndex: 0,
  });

  expect(verdict).toStrictEqual({ kind: 'match', rewardFacts: [], verifiedXPDelta: 215 });
});

test('it reports a hash mismatch when the stored nextSeed was tampered', () => {
  const seed = 'aa'.repeat(16);
  const honestNextSeed = 'bb'.repeat(16);
  const tamperedNextSeed = 'ff'.repeat(16);

  const replayed = [
    { nextSeed: honestNextSeed, rewards: { xp: 0 }, seed, time: 0, type: 'started' },
  ];

  const tamperedHash = buildCheckpointHash({
    chainIndex: 1,
    entropySource: 'server-key',
    nextSeed: tamperedNextSeed,
    prevHash: 'root-hash',
    seed,
    time: 0,
    type: 'started',
    version: 1,
  });

  const stored: Array<StoredCheckpoint> = [
    {
      hash: tamperedHash,
      payload: {
        chainIndex: 1,
        entropySource: 'server-key',
        nextSeed: tamperedNextSeed,
        rewards: { xp: 0 },
        seed,
        time: 0,
        type: 'started',
      },
      prevHash: 'root-hash',
      version: 1,
    },
  ];

  const verdict = compareReplaySegment(stored, replayed, {
    prevHash: 'root-hash',
    seed,
    startChainIndex: 0,
  });

  expect(verdict).toStrictEqual({ kind: 'divergence', reason: 'hash-mismatch', version: 1 });
});

test('it reports a hash mismatch when the stored chainIndex was tampered', () => {
  const seed = 'aa'.repeat(16);
  const nextSeed = 'bb'.repeat(16);
  const replayed = [{ nextSeed, rewards: { xp: 0 }, seed, time: 0, type: 'started' }];

  const tamperedHash = buildCheckpointHash({
    chainIndex: 99,
    entropySource: 'server-key',
    nextSeed,
    prevHash: 'root-hash',
    seed,
    time: 0,
    type: 'started',
    version: 1,
  });

  const stored: Array<StoredCheckpoint> = [
    {
      hash: tamperedHash,
      payload: {
        chainIndex: 99,
        entropySource: 'server-key',
        nextSeed,
        rewards: { xp: 0 },
        seed,
        time: 0,
        type: 'started',
      },
      prevHash: 'root-hash',
      version: 1,
    },
  ];

  const verdict = compareReplaySegment(stored, replayed, {
    prevHash: 'root-hash',
    seed,
    startChainIndex: 0,
  });

  expect(verdict).toStrictEqual({ kind: 'divergence', reason: 'hash-mismatch', version: 1 });
});

test('it reports a hash mismatch when the stored entropySource tag was tampered', () => {
  const seed = 'aa'.repeat(16);
  const nextSeed = 'bb'.repeat(16);
  const replayed = [{ nextSeed, rewards: { xp: 0 }, seed, time: 0, type: 'started' }];

  const tamperedHash = buildCheckpointHash({
    chainIndex: 1,
    entropySource: 'device-key',
    nextSeed,
    prevHash: 'root-hash',
    seed,
    time: 0,
    type: 'started',
    version: 1,
  });

  const stored: Array<StoredCheckpoint> = [
    {
      hash: tamperedHash,
      payload: {
        chainIndex: 1,
        entropySource: 'device-key',
        nextSeed,
        rewards: { xp: 0 },
        seed,
        time: 0,
        type: 'started',
      },
      prevHash: 'root-hash',
      version: 1,
    },
  ];

  const verdict = compareReplaySegment(stored, replayed, {
    prevHash: 'root-hash',
    seed,
    startChainIndex: 0,
  });

  expect(verdict).toStrictEqual({ kind: 'divergence', reason: 'hash-mismatch', version: 1 });
});

test('it reports a reward mismatch when the stored rewards.xp diverges from the replay', () => {
  const seed = 'aa'.repeat(16);
  const nextSeed = 'bb'.repeat(16);
  const replayed = [{ nextSeed, rewards: { xp: 40 }, seed, time: 0, type: 'progress' }];

  const hash = buildCheckpointHash({
    chainIndex: 1,
    entropySource: 'server-key',
    nextSeed,
    prevHash: 'root-hash',
    seed,
    time: 0,
    type: 'progress',
    version: 1,
  });

  const stored: Array<StoredCheckpoint> = [
    {
      hash,
      payload: {
        chainIndex: 1,
        entropySource: 'server-key',
        nextSeed,
        rewards: { xp: 999 },
        seed,
        time: 0,
        type: 'progress',
      },
      prevHash: 'root-hash',
      version: 1,
    },
  ];

  const verdict = compareReplaySegment(stored, replayed, {
    prevHash: 'root-hash',
    seed,
    startChainIndex: 0,
  });

  expect(verdict).toStrictEqual({ kind: 'divergence', reason: 'reward-mismatch', version: 1 });
});

test('it reports a reward mismatch when the stored levelUp diverges from the replay', () => {
  const seed = 'aa'.repeat(16);
  const nextSeed = 'bb'.repeat(16);

  const replayed = [
    { levelUp: { from: 1, to: 2 }, nextSeed, rewards: { xp: 40 }, seed, time: 0, type: 'progress' },
  ];

  const hash = buildCheckpointHash({
    chainIndex: 1,
    entropySource: 'server-key',
    nextSeed,
    prevHash: 'root-hash',
    seed,
    time: 0,
    type: 'progress',
    version: 1,
  });

  const stored: Array<StoredCheckpoint> = [
    {
      hash,
      payload: {
        chainIndex: 1,
        entropySource: 'server-key',
        levelUp: { from: 1, to: 3 },
        nextSeed,
        rewards: { xp: 40 },
        seed,
        time: 0,
        type: 'progress',
      },
      prevHash: 'root-hash',
      version: 1,
    },
  ];

  const verdict = compareReplaySegment(stored, replayed, {
    prevHash: 'root-hash',
    seed,
    startChainIndex: 0,
  });

  expect(verdict).toStrictEqual({ kind: 'divergence', reason: 'reward-mismatch', version: 1 });
});

test('it reports a checkpoint-count mismatch when the replay produces fewer checkpoints than stored', () => {
  const seed = 'aa'.repeat(16);
  const nextSeed = 'bb'.repeat(16);
  const replayed: Array<never> = [];

  const hash = buildCheckpointHash({
    chainIndex: 1,
    entropySource: 'server-key',
    nextSeed,
    prevHash: 'root-hash',
    seed,
    time: 0,
    type: 'started',
    version: 1,
  });

  const stored: Array<StoredCheckpoint> = [
    {
      hash,
      payload: {
        chainIndex: 1,
        entropySource: 'server-key',
        nextSeed,
        rewards: { xp: 0 },
        seed,
        time: 0,
        type: 'started',
      },
      prevHash: 'root-hash',
      version: 1,
    },
  ];

  const verdict = compareReplaySegment(stored, replayed, {
    prevHash: 'root-hash',
    seed,
    startChainIndex: 0,
  });

  expect(verdict).toStrictEqual({
    kind: 'divergence',
    reason: 'checkpoint-count-mismatch',
    version: 1,
  });
});

test('it reports the activity-wide version of a count mismatch on a later batch, not a tail-relative one', () => {
  const seed = 'aa'.repeat(16);
  const nextSeed = 'bb'.repeat(16);
  const replayed = [{ nextSeed, rewards: { xp: 0 }, seed, time: 0, type: 'progress' }];

  const hash = buildCheckpointHash({
    chainIndex: 5,
    entropySource: 'server-key',
    nextSeed,
    prevHash: 'root-hash',
    seed,
    time: 0,
    type: 'progress',
    version: 5,
  });

  const secondNextSeed = 'cc'.repeat(16);

  const secondHash = buildCheckpointHash({
    chainIndex: 6,
    entropySource: 'server-key',
    nextSeed: secondNextSeed,
    prevHash: hash,
    seed: nextSeed,
    time: 1000,
    type: 'progress',
    version: 6,
  });

  const stored: Array<StoredCheckpoint> = [
    {
      hash,
      payload: {
        chainIndex: 5,
        entropySource: 'server-key',
        nextSeed,
        rewards: { xp: 0 },
        seed,
        time: 0,
        type: 'progress',
      },
      prevHash: 'root-hash',
      version: 5,
    },
    {
      hash: secondHash,
      payload: {
        chainIndex: 6,
        entropySource: 'server-key',
        nextSeed: secondNextSeed,
        rewards: { xp: 0 },
        seed: nextSeed,
        time: 1000,
        type: 'progress',
      },
      prevHash: hash,
      version: 6,
    },
  ];

  const verdict = compareReplaySegment(stored, replayed, {
    prevHash: 'root-hash',
    seed,
    startChainIndex: 0,
  });

  expect(verdict).toStrictEqual({
    kind: 'divergence',
    reason: 'checkpoint-count-mismatch',
    version: 6,
  });
});

test('it chains the seed and hash forward across a multi-checkpoint segment', () => {
  const seed1 = 'aa'.repeat(16);
  const seed2 = 'bb'.repeat(16);
  const seed3 = 'cc'.repeat(16);

  const replayed = [
    { nextSeed: seed2, rewards: { xp: 0 }, seed: seed1, time: 0, type: 'started' },
    { nextSeed: seed3, rewards: { xp: 40 }, time: 1000, type: 'progress' },
  ];

  const hash1 = buildCheckpointHash({
    chainIndex: 1,
    entropySource: 'server-key',
    nextSeed: seed2,
    prevHash: 'root-hash',
    seed: seed1,
    time: 0,
    type: 'started',
    version: 1,
  });

  const hash2 = buildCheckpointHash({
    chainIndex: 2,
    entropySource: 'server-key',
    nextSeed: seed3,
    prevHash: hash1,
    seed: seed2,
    time: 1000,
    type: 'progress',
    version: 2,
  });

  const stored: Array<StoredCheckpoint> = [
    {
      hash: hash1,
      payload: {
        chainIndex: 1,
        entropySource: 'server-key',
        nextSeed: seed2,
        rewards: { xp: 0 },
        seed: seed1,
        time: 0,
        type: 'started',
      },
      prevHash: 'root-hash',
      version: 1,
    },
    {
      hash: hash2,
      payload: {
        chainIndex: 2,
        entropySource: 'server-key',
        nextSeed: seed3,
        rewards: { xp: 40 },
        seed: seed2,
        time: 1000,
        type: 'progress',
      },
      prevHash: hash1,
      version: 2,
    },
  ];

  const verdict = compareReplaySegment(stored, replayed, {
    prevHash: 'root-hash',
    seed: seed1,
    startChainIndex: 0,
  });

  expect(verdict).toStrictEqual({ kind: 'match', rewardFacts: [], verifiedXPDelta: 0 });
});
