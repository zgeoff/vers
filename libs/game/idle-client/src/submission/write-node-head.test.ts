import { expect, test } from 'bun:test';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { readNodeSeed } from './read-node-seed';
import { writeNodeHead } from './write-node-head';
import { writeNodeSeeds } from './write-node-seeds';

test("it advances a cached node's head in place, leaving its other fields untouched", async () => {
  const avatarID = 'avatar-write-node-head';
  const seed = createMockNodeSeed({ avatarID, head: { chainIndex: 0, nextSeed: 'seed-genesis' } });

  await writeNodeSeeds(avatarID, [seed]);
  await writeNodeHead(avatarID, seed.nodeID, { chainIndex: 3, nextSeed: 'seed-advanced' });

  const cached = await readNodeSeed(avatarID, seed.nodeID);

  expect(cached).toStrictEqual({
    contentVersion: seed.contentVersion,
    encounterNode: seed.encounterNode,
    genesisSeed: seed.genesisSeed,
    head: { chainIndex: 3, nextSeed: 'seed-advanced' },
  });
});

test('it is a no-op when the node was never cached for the avatar', async () => {
  await writeNodeHead('avatar-write-node-head-uncached', '9_9', {
    chainIndex: 1,
    nextSeed: 'seed-never-cached',
  });

  const cached = await readNodeSeed('avatar-write-node-head-uncached', '9_9');

  expect(cached).toBeUndefined();
});
