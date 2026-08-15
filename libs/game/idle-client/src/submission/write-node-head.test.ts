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

test('it advances the cached head to an incoming head at the same or a later index', async () => {
  const avatarID = 'avatar-write-node-head-advance';
  const seed = createMockNodeSeed({ avatarID, head: { chainIndex: 4, nextSeed: 'seed-at-four' } });

  await writeNodeSeeds(avatarID, [seed]);
  await writeNodeHead(avatarID, seed.nodeID, { chainIndex: 6, nextSeed: 'seed-at-six' });

  const cached = await readNodeSeed(avatarID, seed.nodeID);

  expect(cached?.head).toStrictEqual({ chainIndex: 6, nextSeed: 'seed-at-six' });
});

test('it discards an out-of-order lower-index write rather than regressing the cached head', async () => {
  const avatarID = 'avatar-write-node-head-regress';
  const seed = createMockNodeSeed({ avatarID, head: { chainIndex: 7, nextSeed: 'seed-at-seven' } });

  await writeNodeSeeds(avatarID, [seed]);
  await writeNodeHead(avatarID, seed.nodeID, { chainIndex: 3, nextSeed: 'seed-at-three' });

  const cached = await readNodeSeed(avatarID, seed.nodeID);

  expect(cached?.head).toStrictEqual({ chainIndex: 7, nextSeed: 'seed-at-seven' });
});

test('it is a no-op when the node was never cached for the avatar', async () => {
  await writeNodeHead('avatar-write-node-head-uncached', '9_9', {
    chainIndex: 1,
    nextSeed: 'seed-never-cached',
  });

  const cached = await readNodeSeed('avatar-write-node-head-uncached', '9_9');

  expect(cached).toBeUndefined();
});
