import { expect, test } from 'bun:test';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { readNodeSeed } from './read-node-seed';
import { writeNodeSeeds } from './write-node-seeds';
import { writeServerNodeAnchor } from './write-server-node-anchor';

test("it moves a cached anchor back to the server's anchor, keeping the rest of the node's cache", async () => {
  const seed = createMockNodeSeed({
    avatarID: 'avatar_rewound',
    anchor: { chainIndex: 9, nextSeed: 'seed_local_9' },
    nodeID: '2_3',
  });

  await writeNodeSeeds(seed.avatarID, [seed]);

  await writeServerNodeAnchor(seed.avatarID, seed.nodeID, {
    chainIndex: 4,
    nextSeed: 'seed_server_4',
  });

  const cached = await readNodeSeed(seed.avatarID, seed.nodeID);

  expect(cached).toStrictEqual({
    anchor: { chainIndex: 4, nextSeed: 'seed_server_4' },
    contentVersion: seed.contentVersion,
    encounterNode: seed.encounterNode,
    genesisSeed: seed.genesisSeed,
  });
});

test('it caches nothing for a node the device holds no seed for', async () => {
  await writeServerNodeAnchor('avatar_uncached', '7_7', {
    chainIndex: 4,
    nextSeed: 'seed_server_4',
  });

  const cached = await readNodeSeed('avatar_uncached', '7_7');

  expect(cached).toBeUndefined();
});
