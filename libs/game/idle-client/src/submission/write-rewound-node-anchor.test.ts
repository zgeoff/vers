import { expect, test } from 'bun:test';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { readNodeSeed } from './read-node-seed';
import { writeNodeSeeds } from './write-node-seeds';
import { writeRewoundNodeAnchor } from './write-rewound-node-anchor';

test("it moves a cached anchor back to an earlier anchor, keeping the rest of the node's cache", async () => {
  const seed = createMockNodeSeed({
    avatarID: 'avatar_rewound',
    anchor: { chainIndex: 8, nextSeed: 'seed_local_8' },
    nodeID: '1_4',
  });

  await writeNodeSeeds(seed.avatarID, [seed]);

  await writeRewoundNodeAnchor(seed.avatarID, seed.nodeID, {
    chainIndex: 5,
    nextSeed: 'seed_start_5',
  });

  const cached = await readNodeSeed(seed.avatarID, seed.nodeID);

  expect(cached).toStrictEqual({
    anchor: { chainIndex: 5, nextSeed: 'seed_start_5' },
    contentVersion: seed.contentVersion,
    encounterNode: seed.encounterNode,
    genesisSeed: seed.genesisSeed,
  });
});

test('it never moves a cached anchor forward', async () => {
  const seed = createMockNodeSeed({
    avatarID: 'avatar_behind',
    anchor: { chainIndex: 3, nextSeed: 'seed_local_3' },
    nodeID: '2_2',
  });

  await writeNodeSeeds(seed.avatarID, [seed]);

  await writeRewoundNodeAnchor(seed.avatarID, seed.nodeID, {
    chainIndex: 6,
    nextSeed: 'seed_start_6',
  });

  const cached = await readNodeSeed(seed.avatarID, seed.nodeID);

  expect(cached?.anchor).toStrictEqual({ chainIndex: 3, nextSeed: 'seed_local_3' });
});

test('it caches nothing for a node the device holds no seed for', async () => {
  await writeRewoundNodeAnchor('avatar_uncached', '6_6', {
    chainIndex: 2,
    nextSeed: 'seed_start_2',
  });

  const cached = await readNodeSeed('avatar_uncached', '6_6');

  expect(cached).toBeUndefined();
});
