import { expect, test } from 'bun:test';
import { createMockReplaySegment } from '../test-utils/factories/create-mock-replay-segment';
import { findSeedDivergence } from './find-seed-divergence';

test('it finds no divergence for a genesis activity seeded from the chain genesis', () => {
  const segment = createMockReplaySegment();

  expect(findSeedDivergence(segment)).toBeUndefined();
});

test('it finds no divergence for a continuation seeded from the verified anchor', () => {
  const segment = createMockReplaySegment({
    activity: {
      appendedTimeMs: 0,
      avatarID: 'avatar_1',
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '0.0.0-dev',
      id: 'act_2',
      keyVersion: 1,
      scopeID: 'node_1',
      scopeType: 'world_map_node',
      seed: 'bb'.repeat(16),
      simVersion: 'test-engine-hash',
      startChainIndex: 4,
    },
    chain: {
      genesisSeed: 'aa'.repeat(16),
      verifiedChainIndex: 4,
      verifiedNextSeed: 'bb'.repeat(16),
    },
  });

  expect(findSeedDivergence(segment)).toBeUndefined();
});

test('it skips the check once an activity has already verified past its first batch', () => {
  const segment = createMockReplaySegment({ verifiedHead: 3 });

  expect(findSeedDivergence(segment)).toBeUndefined();
});

test('it flags a genesis activity whose seed does not match the chain genesis', () => {
  const segment = createMockReplaySegment({
    activity: {
      appendedTimeMs: 0,
      avatarID: 'avatar_1',
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '0.0.0-dev',
      id: 'act_1',
      keyVersion: 1,
      scopeID: 'node_1',
      scopeType: 'world_map_node',
      seed: 'ff'.repeat(16),
      simVersion: 'test-engine-hash',
      startChainIndex: 0,
    },
    chain: {
      genesisSeed: 'aa'.repeat(16),
      verifiedChainIndex: 0,
      verifiedNextSeed: 'aa'.repeat(16),
    },
  });

  expect(findSeedDivergence(segment)).toStrictEqual({
    kind: 'divergence',
    reason: 'seed-mismatch',
    version: 1,
  });
});

test('it flags a continuation whose seed does not match the chain verified anchor', () => {
  const segment = createMockReplaySegment({
    activity: {
      appendedTimeMs: 0,
      avatarID: 'avatar_1',
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '0.0.0-dev',
      id: 'act_2',
      keyVersion: 1,
      scopeID: 'node_1',
      scopeType: 'world_map_node',
      seed: 'ff'.repeat(16),
      simVersion: 'test-engine-hash',
      startChainIndex: 4,
    },
    chain: {
      genesisSeed: 'aa'.repeat(16),
      verifiedChainIndex: 4,
      verifiedNextSeed: 'bb'.repeat(16),
    },
  });

  expect(findSeedDivergence(segment)).toStrictEqual({
    kind: 'divergence',
    reason: 'seed-mismatch',
    version: 1,
  });
});

test('it flags a continuation rooted ahead of the chain verified position', () => {
  const segment = createMockReplaySegment({
    activity: {
      appendedTimeMs: 0,
      avatarID: 'avatar_1',
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '0.0.0-dev',
      id: 'act_2',
      keyVersion: 1,
      scopeID: 'node_1',
      scopeType: 'world_map_node',
      seed: 'bb'.repeat(16),
      simVersion: 'test-engine-hash',
      startChainIndex: 4,
    },
    chain: {
      genesisSeed: 'aa'.repeat(16),
      verifiedChainIndex: 2,
      verifiedNextSeed: 'cc'.repeat(16),
    },
  });

  expect(findSeedDivergence(segment)).toStrictEqual({
    kind: 'divergence',
    reason: 'seed-mismatch',
    version: 1,
  });
});
