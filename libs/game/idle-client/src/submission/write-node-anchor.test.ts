import { expect, test } from 'bun:test';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { readNodeSeed } from './read-node-seed';
import { writeNodeAnchor } from './write-node-anchor';
import { writeNodeSeeds } from './write-node-seeds';

test("it advances a cached node's anchor in place, leaving its other fields untouched", async () => {
  const avatarID = 'avatar-write-node-anchor';

  const seed = createMockNodeSeed({
    avatarID,
    anchor: { chainIndex: 0, nextSeed: 'seed-genesis' },
  });

  await writeNodeSeeds(avatarID, [seed]);
  await writeNodeAnchor(avatarID, seed.nodeID, { chainIndex: 3, nextSeed: 'seed-advanced' });

  const cached = await readNodeSeed(avatarID, seed.nodeID);

  expect(cached).toStrictEqual({
    contentVersion: seed.contentVersion,
    encounterNode: seed.encounterNode,
    genesisSeed: seed.genesisSeed,
    anchor: { chainIndex: 3, nextSeed: 'seed-advanced' },
  });
});

test('it advances the cached anchor to an incoming anchor at the same or a later index', async () => {
  const avatarID = 'avatar-write-node-anchor-advance';

  const seed = createMockNodeSeed({
    avatarID,
    anchor: { chainIndex: 4, nextSeed: 'seed-at-four' },
  });

  await writeNodeSeeds(avatarID, [seed]);
  await writeNodeAnchor(avatarID, seed.nodeID, { chainIndex: 6, nextSeed: 'seed-at-six' });

  const cached = await readNodeSeed(avatarID, seed.nodeID);

  expect(cached?.anchor).toStrictEqual({ chainIndex: 6, nextSeed: 'seed-at-six' });
});

test('it overwrites the cached anchor with an incoming anchor at the same index', async () => {
  // the equal-index boundary is where the guard switches from discarding to overwriting: a resend
  // of the same position carries the seed the device actually reached, so it must win
  const avatarID = 'avatar-write-node-anchor-equal';

  const seed = createMockNodeSeed({
    avatarID,
    anchor: { chainIndex: 5, nextSeed: 'seed-first-at-five' },
  });

  await writeNodeSeeds(avatarID, [seed]);
  await writeNodeAnchor(avatarID, seed.nodeID, { chainIndex: 5, nextSeed: 'seed-second-at-five' });

  const cached = await readNodeSeed(avatarID, seed.nodeID);

  expect(cached?.anchor).toStrictEqual({ chainIndex: 5, nextSeed: 'seed-second-at-five' });
});

test('it discards an out-of-order lower-index write rather than regressing the cached anchor', async () => {
  const avatarID = 'avatar-write-node-anchor-regress';

  const seed = createMockNodeSeed({
    avatarID,
    anchor: { chainIndex: 7, nextSeed: 'seed-at-seven' },
  });

  await writeNodeSeeds(avatarID, [seed]);
  await writeNodeAnchor(avatarID, seed.nodeID, { chainIndex: 3, nextSeed: 'seed-at-three' });

  const cached = await readNodeSeed(avatarID, seed.nodeID);

  expect(cached?.anchor).toStrictEqual({ chainIndex: 7, nextSeed: 'seed-at-seven' });
});

test('it is a no-op when the node was never cached for the avatar', async () => {
  await writeNodeAnchor('avatar-write-node-anchor-uncached', '9_9', {
    chainIndex: 1,
    nextSeed: 'seed-never-cached',
  });

  const cached = await readNodeSeed('avatar-write-node-anchor-uncached', '9_9');

  expect(cached).toBeUndefined();
});
