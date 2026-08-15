import { expect, test } from 'bun:test';
import invariant from 'tiny-invariant';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { NODE_SEEDS_STORE_NAME } from './constants';
import { readCachedNodeIDs } from './read-cached-node-ids';
import { readNodeSeed } from './read-node-seed';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { NodeSeed } from './types';
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
    head: first.head,
  });

  expect(secondSeed).toStrictEqual({
    contentVersion: second.contentVersion,
    encounterNode: second.encounterNode,
    genesisSeed: second.genesisSeed,
    head: second.head,
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
    head: seed.head,
  });
});

test("it keeps the cached head when a reveal's head is behind this device's own local advance", async () => {
  const avatarID = 'avatar-write-head-guard';
  const seed = createMockNodeSeed({ head: { chainIndex: 4, nextSeed: 'seed-advanced' } });

  await writeNodeSeeds(avatarID, [seed]);

  await writeNodeSeeds(avatarID, [
    { ...seed, head: { chainIndex: 0, nextSeed: seed.genesisSeed } },
  ]);

  const cachedSeed = await readNodeSeed(avatarID, seed.nodeID);

  expect(cachedSeed?.head).toStrictEqual({ chainIndex: 4, nextSeed: 'seed-advanced' });
});

test("it adopts a reveal's head when it is at least as advanced as the cached one", async () => {
  const avatarID = 'avatar-write-head-advance';
  const seed = createMockNodeSeed({ head: { chainIndex: 1, nextSeed: 'seed-one' } });

  await writeNodeSeeds(avatarID, [seed]);
  await writeNodeSeeds(avatarID, [{ ...seed, head: { chainIndex: 2, nextSeed: 'seed-two' } }]);

  const cachedSeed = await readNodeSeed(avatarID, seed.nodeID);

  expect(cachedSeed?.head).toStrictEqual({ chainIndex: 2, nextSeed: 'seed-two' });
});

test('it adopts a reveal head over a pre-v6 cached row that predates the head field', async () => {
  const avatarID = 'avatar-write-head-legacy-row';
  const seed = createMockNodeSeed({ head: { chainIndex: 3, nextSeed: 'seed-legacy-reveal' } });

  const db = await resolveCheckpointQueueDB();

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- simulates a pre-v6 row that predates the `head` field, which the current `NodeSeed` type can no longer express
  await db.put(NODE_SEEDS_STORE_NAME, {
    avatarID,
    contentVersion: seed.contentVersion,
    encounterNode: seed.encounterNode,
    genesisSeed: seed.genesisSeed,
    nodeID: seed.nodeID,
  } as unknown as NodeSeed);

  await writeNodeSeeds(avatarID, [seed]);

  const cachedSeed = await readNodeSeed(avatarID, seed.nodeID);

  expect(cachedSeed?.head).toStrictEqual({ chainIndex: 3, nextSeed: 'seed-legacy-reveal' });
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
