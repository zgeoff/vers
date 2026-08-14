import { expect, test } from 'bun:test';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { readCachedNodeIDs } from './read-cached-node-ids';
import { writeNodeSeeds } from './write-node-seeds';

test('it returns an empty set with nothing cached for the avatar', async () => {
  const cachedNodeIDs = await readCachedNodeIDs('avatar-empty');

  expect(cachedNodeIDs).toStrictEqual(new Set());
});

test('it returns every cached node id for the avatar', async () => {
  const avatarID = 'avatar-cached';
  const first = createMockNodeSeed();
  const second = createMockNodeSeed();

  await writeNodeSeeds(avatarID, [first, second]);

  const cachedNodeIDs = await readCachedNodeIDs(avatarID);

  expect([...cachedNodeIDs]).toIncludeAllMembers([first.nodeID, second.nodeID]);
});

test("it returns only the queried avatar's cached node ids", async () => {
  const own = createMockNodeSeed({ nodeID: '1_1' });
  const other = createMockNodeSeed({ nodeID: '2_2' });

  await writeNodeSeeds('avatar-self', [own]);
  await writeNodeSeeds('avatar-other', [other]);

  const cachedNodeIDs = await readCachedNodeIDs('avatar-self');

  expect([...cachedNodeIDs]).toStrictEqual(['1_1']);
});
