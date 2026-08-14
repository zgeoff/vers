import { expect, test } from 'bun:test';
import invariant from 'tiny-invariant';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { readCachedNodeIDs } from './read-cached-node-ids';
import { readNodeSeed } from './read-node-seed';
import { writeNodeSeeds } from './write-node-seeds';

test("it persists a batch of one avatar's start inputs retrievable by node id", async () => {
  const avatarID = 'avatar-write-batch';
  const first = createMockNodeSeed({ nodeID: '1_0' });
  const second = createMockNodeSeed({ nodeID: '2_0' });

  await writeNodeSeeds(avatarID, [first, second]);

  const firstSeed = await readNodeSeed(avatarID, first.nodeID);
  const secondSeed = await readNodeSeed(avatarID, second.nodeID);

  expect(firstSeed).toStrictEqual({
    contentVersion: first.contentVersion,
    encounterNode: first.encounterNode,
    genesisSeed: first.genesisSeed,
  });

  expect(secondSeed).toStrictEqual({
    contentVersion: second.contentVersion,
    encounterNode: second.encounterNode,
    genesisSeed: second.genesisSeed,
  });
});

test('it keeps one row with the same seed when the same node is cached again', async () => {
  const avatarID = 'avatar-write-idempotent';
  const seed = createMockNodeSeed();

  await writeNodeSeeds(avatarID, [seed]);
  await writeNodeSeeds(avatarID, [seed]);

  const cachedNodeIDs = await readCachedNodeIDs(avatarID);
  const cachedSeed = await readNodeSeed(avatarID, seed.nodeID);

  expect([...cachedNodeIDs].filter((nodeID) => nodeID === seed.nodeID)).toStrictEqual([
    seed.nodeID,
  ]);

  expect(cachedSeed).toStrictEqual({
    contentVersion: seed.contentVersion,
    encounterNode: seed.encounterNode,
    genesisSeed: seed.genesisSeed,
  });
});

test('it scopes a shared node id to each avatar so one never overwrites the other', async () => {
  const nodeID = '3_3';
  const first = createMockNodeSeed({ genesisSeed: 'seed-first', nodeID });
  const second = createMockNodeSeed({ genesisSeed: 'seed-second', nodeID });

  await writeNodeSeeds('avatar-one', [first]);
  await writeNodeSeeds('avatar-two', [second]);

  const firstSeed = await readNodeSeed('avatar-one', nodeID);
  const secondSeed = await readNodeSeed('avatar-two', nodeID);

  invariant(firstSeed && secondSeed, 'both avatars must have a cached node seed');

  expect(firstSeed.genesisSeed).toBe('seed-first');
  expect(secondSeed.genesisSeed).toBe('seed-second');
});
