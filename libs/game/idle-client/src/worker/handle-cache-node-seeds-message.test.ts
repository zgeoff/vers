import { expect, test } from 'bun:test';
import { readNodeSeed } from '../submission/read-node-seed';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { handleCacheNodeSeedsMessage } from './handle-cache-node-seeds-message';

test('it routes the relayed batch into the durable cache under the message avatar', async () => {
  const avatarID = 'avatar-handler';
  const first = createMockNodeSeed();
  const second = createMockNodeSeed();

  await handleCacheNodeSeedsMessage({ avatarID, seeds: [first, second] });

  const firstSeed = await readNodeSeed(avatarID, first.nodeID);
  const secondSeed = await readNodeSeed(avatarID, second.nodeID);

  expect(firstSeed).toBe(first.genesisSeed);
  expect(secondSeed).toBe(second.genesisSeed);
});
