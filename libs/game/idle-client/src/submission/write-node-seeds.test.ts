import { expect, test } from 'bun:test';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { readCachedNodeIDs } from './read-cached-node-ids';
import { readNodeSeed } from './read-node-seed';
import { writeNodeSeeds } from './write-node-seeds';

test('it persists a batch of seeds retrievable by node id', async () => {
  const first = createMockNodeSeed();
  const second = createMockNodeSeed();

  await writeNodeSeeds([first, second]);

  const firstSeed = await readNodeSeed(first.nodeID);
  const secondSeed = await readNodeSeed(second.nodeID);

  expect(firstSeed).toBe(first.genesisSeed);
  expect(secondSeed).toBe(second.genesisSeed);
});

test('it keeps one row with the same seed when the same node is cached again', async () => {
  const seed = createMockNodeSeed();

  await writeNodeSeeds([seed]);
  await writeNodeSeeds([seed]);

  const cachedNodeIDs = await readCachedNodeIDs();
  const cachedSeed = await readNodeSeed(seed.nodeID);

  expect([...cachedNodeIDs].filter((nodeID) => nodeID === seed.nodeID)).toStrictEqual([
    seed.nodeID,
  ]);

  expect(cachedSeed).toBe(seed.genesisSeed);
});
