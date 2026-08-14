import { expect, test } from 'bun:test';
import { createMockNodeSeed } from './create-mock-node-seed';

test('it builds a default node seed', () => {
  const seed = createMockNodeSeed();

  expect(seed).toStrictEqual({
    avatarID: expect.toBeString(),
    genesisSeed: expect.toBeString(),
    nodeID: expect.toBeString(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const seed = createMockNodeSeed({ nodeID: '5_5' });

  expect(seed).toStrictEqual({
    avatarID: expect.toBeString(),
    genesisSeed: expect.toBeString(),
    nodeID: '5_5',
  });
});
