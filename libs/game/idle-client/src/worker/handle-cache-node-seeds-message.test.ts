import { expect, test } from 'bun:test';
import { readNodeSeed } from '../submission/read-node-seed';
import { readStartStamps } from '../submission/read-start-stamps';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { handleCacheNodeSeedsMessage } from './handle-cache-node-seeds-message';

test('it routes the relayed batch into the durable cache under the message avatar', async () => {
  const avatarID = 'avatar-handler';
  const first = createMockNodeSeed();
  const second = createMockNodeSeed();

  await handleCacheNodeSeedsMessage({
    avatarID,
    seeds: [first, second],
    stamps: { keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 },
  });

  const firstSeed = await readNodeSeed(avatarID, first.nodeID);
  const secondSeed = await readNodeSeed(avatarID, second.nodeID);

  expect(firstSeed).toStrictEqual({
    contentVersion: first.contentVersion,
    encounterNode: first.encounterNode,
    genesisSeed: first.genesisSeed,
    anchor: first.anchor,
  });

  expect(secondSeed).toStrictEqual({
    contentVersion: second.contentVersion,
    encounterNode: second.encounterNode,
    genesisSeed: second.genesisSeed,
    anchor: second.anchor,
  });
});

test('it caches the relayed crypto stamps alongside the seed batch', async () => {
  await handleCacheNodeSeedsMessage({
    avatarID: 'avatar-handler-stamps',
    seeds: [],
    stamps: { keyVersion: 2, secretRef: 'worldmap', secretVersion: 3 },
  });

  const stamps = await readStartStamps();

  expect(stamps).toStrictEqual({ keyVersion: 2, secretRef: 'worldmap', secretVersion: 3 });
});
