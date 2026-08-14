import { expect, test } from 'bun:test';
import { createMockNodeSeed } from './create-mock-node-seed';

test('it builds a default node seed', () => {
  const seed = createMockNodeSeed();

  expect(seed).toStrictEqual({
    genesisSeed: expect.toBeString(),
    nodeID: expect.toBeString(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const seed = createMockNodeSeed({ genesisSeed: 'seed_1', nodeID: '5_5' });

  expect(seed).toStrictEqual({ genesisSeed: 'seed_1', nodeID: '5_5' });
});
