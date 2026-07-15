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
