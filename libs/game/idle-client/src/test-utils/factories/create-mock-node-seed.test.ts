import { expect, test } from 'bun:test';
import { createMockNodeSeed } from './create-mock-node-seed';

test('it builds a default node seed', () => {
  const seed = createMockNodeSeed();

  expect(seed).toStrictEqual({
    avatarID: expect.toBeString(),
    contentVersion: expect.toBeString(),
    encounterNode: expect.toBeObject(),
    genesisSeed: expect.toBeString(),
    anchor: { chainIndex: 0, nextSeed: seed.genesisSeed },
    nodeID: expect.toBeString(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const seed = createMockNodeSeed({
    contentVersion: '3',
    encounterNode: { difficulty: 5 },
    anchor: { chainIndex: 4, nextSeed: 'seed-advanced' },
    nodeID: '5_5',
  });

  expect(seed).toStrictEqual({
    avatarID: expect.toBeString(),
    contentVersion: '3',
    encounterNode: { difficulty: 5 },
    genesisSeed: expect.toBeString(),
    anchor: { chainIndex: 4, nextSeed: 'seed-advanced' },
    nodeID: '5_5',
  });
});
