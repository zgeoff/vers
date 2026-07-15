import { expect, test } from 'bun:test';
import { createMockReplaySegment } from './create-mock-replay-segment';

test('it builds a genesis segment whose activity seed matches the chain genesis', () => {
  const segment = createMockReplaySegment();

  expect(segment.activity.seed).toBe(segment.chain.genesisSeed);
  expect(segment.activity.seed).toBe(segment.chain.verifiedNextSeed);
  expect(segment.activity.startChainIndex).toBe(0);
  expect(segment.checkpoints).toBeEmpty();
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
