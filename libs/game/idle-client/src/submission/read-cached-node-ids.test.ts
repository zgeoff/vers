import { expect, test } from 'bun:test';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { readCachedNodeIDs } from './read-cached-node-ids';
import { writeNodeSeeds } from './write-node-seeds';

test('it returns an empty set with nothing cached', async () => {
  const cachedNodeIDs = await readCachedNodeIDs();

  expect(cachedNodeIDs).toStrictEqual(new Set());
});

test('it returns every cached node id', async () => {
  const first = createMockNodeSeed();
  const second = createMockNodeSeed();

  await writeNodeSeeds([first, second]);

  const cachedNodeIDs = await readCachedNodeIDs();

  expect([...cachedNodeIDs]).toIncludeAllMembers([first.nodeID, second.nodeID]);
});
