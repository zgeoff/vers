import { expect, test } from 'bun:test';
import { createMockReplaySegment } from './create-mock-replay-segment';

test('it builds a default genesis segment', () => {
  const segment = createMockReplaySegment();

  expect(segment).toStrictEqual({
    activity: {
      appendedHead: 0,
      appendedTimeMs: 0,
      avatarID: expect.toBeString(),
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '0.0.0-dev',
      encounterNode: { difficulty: 1 },
      id: expect.toStartWith('act_'),
      keyVersion: 1,
      scopeID: expect.toBeString(),
      scopeType: 'world_map_node',
      secretRef: 'worldmap',
      secretVersion: 1,
      seed: expect.toBeString(),
      settledXP: 0,
      simVersion: 'test-engine-hash',
      startChainIndex: 0,
      status: 'active',
    },
    chain: {
      genesisSeed: segment.activity.seed,
      verifiedChainIndex: 0,
      verifiedNextSeed: segment.activity.seed,
    },
    checkpoints: [],
    prevHash: expect.toBeString(),
    seed: segment.activity.seed,
    verifiedHead: 0,
  });
});

test('it keeps explicit overrides', () => {
  const segment = createMockReplaySegment({ verifiedHead: 3 });

  expect(segment.verifiedHead).toBe(3);
});

test('it rebuilds the derived seed fields from an overridden activity seed', () => {
  const seed = 'cc'.repeat(16);
  const segment = createMockReplaySegment({ activity: { seed } });

  expect(segment.seed).toBe(seed);
  expect(segment.chain.genesisSeed).toBe(seed);
  expect(segment.chain.verifiedNextSeed).toBe(seed);
});

test('it keeps an explicit chain override over the seed-derived one', () => {
  const chainSeed = 'dd'.repeat(16);
  const segment = createMockReplaySegment({ chain: { verifiedNextSeed: chainSeed } });

  expect(segment.chain.verifiedNextSeed).toBe(chainSeed);
  expect(segment.chain.genesisSeed).toBe(segment.activity.seed);
});
