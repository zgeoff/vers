import { expect, test } from 'bun:test';
import { readNodeSeed } from '../submission/read-node-seed';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { handleCacheNodeSeedsMessage } from './handle-cache-node-seeds-message';

test('it persists every seed in the batch to the durable cache', async () => {
  const first = createMockNodeSeed();
  const second = createMockNodeSeed();

  await handleCacheNodeSeedsMessage({ seeds: [first, second] });

  const firstSeed = await readNodeSeed(first.nodeID);
  const secondSeed = await readNodeSeed(second.nodeID);

  expect(firstSeed).toBe(first.genesisSeed);
  expect(secondSeed).toBe(second.genesisSeed);
});

test('it keeps the same seed when the same node is cached again', async () => {
  const seed = createMockNodeSeed();

  await handleCacheNodeSeedsMessage({ seeds: [seed] });
  await handleCacheNodeSeedsMessage({ seeds: [seed] });

  const cachedSeed = await readNodeSeed(seed.nodeID);

  expect(cachedSeed).toBe(seed.genesisSeed);
});
