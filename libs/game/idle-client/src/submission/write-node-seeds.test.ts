import { expect, test } from 'bun:test';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { readCachedNodeIDs } from './read-cached-node-ids';
import { readNodeSeed } from './read-node-seed';
import { writeNodeSeeds } from './write-node-seeds';

test("it persists a batch of one avatar's seeds retrievable by node id", async () => {
  const avatarID = 'avatar-write-batch';
  const first = createMockNodeSeed();
  const second = createMockNodeSeed();

  await writeNodeSeeds(avatarID, [first, second]);

  const firstSeed = await readNodeSeed(avatarID, first.nodeID);
  const secondSeed = await readNodeSeed(avatarID, second.nodeID);

  expect(firstSeed).toBe(first.genesisSeed);
  expect(secondSeed).toBe(second.genesisSeed);
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

  expect(cachedSeed).toBe(seed.genesisSeed);
});

test('it scopes a shared node id to each avatar so one never overwrites the other', async () => {
  const nodeID = '3_3';
  const first = createMockNodeSeed({ genesisSeed: 'seed-first', nodeID });
  const second = createMockNodeSeed({ genesisSeed: 'seed-second', nodeID });

  await writeNodeSeeds('avatar-one', [first]);
  await writeNodeSeeds('avatar-two', [second]);

  const firstSeed = await readNodeSeed('avatar-one', nodeID);
  const secondSeed = await readNodeSeed('avatar-two', nodeID);

  expect(firstSeed).toBe('seed-first');
  expect(secondSeed).toBe('seed-second');
});
