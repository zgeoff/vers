import { expect, test } from 'bun:test';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { buildPositionStream, rollItemFromStream } from '@vers/item-gen';
import { resolveServiceURL } from '@vers/mock-services';
import { deriveAvatarKey } from '@vers/roll-crypto';
import { getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { rollRewardItems } from './roll-reward-items';

/**
 * Reproduces the mocked keys backend's own root formula (`@vers/mock-services/keys`), so the
 * expected content below is computed through the identical derivation the mint step dispatches
 * to.
 */
function buildMockTradeRoot(keyVersion: number): Uint8Array {
  return sha256(utf8ToBytes(`vers-mock-root|trade|${keyVersion}`));
}

test('it rolls no items and dispatches nothing for an empty fact list', async () => {
  const keyPair = await getTestServiceKeyPair();

  const items = await rollRewardItems(
    { keysServiceURL: 'http://127.0.0.1:1', privateKey: keyPair.privateKey },
    {
      avatarID: 'avatar_1',
      keyVersion: 1,
      rewardFacts: [],
      scopeID: 'node_1',
      scopeType: 'world_map_node',
      tables: createMockContentDocument().loot,
    },
  );

  expect(items).toStrictEqual([]);
});

test('it mints content identical to rolling the same coordinate directly', async () => {
  const keyPair = await getTestServiceKeyPair();

  const loot = createMockContentDocument().loot;

  const items = await rollRewardItems(
    { keysServiceURL: resolveServiceURL('keys'), privateKey: keyPair.privateKey },
    {
      avatarID: 'avatar_1',
      keyVersion: 1,
      rewardFacts: [{ chainIndex: 5, nodeTier: 2, ordinal: 0 }],
      scopeID: 'node_1',
      scopeType: 'world_map_node',
      tables: loot,
    },
  );

  const rollKey = deriveAvatarKey({
    avatarID: 'avatar_1',
    keyVersion: 1,
    population: 'trade',
    root: buildMockTradeRoot(1),
  });

  const stream = buildPositionStream(rollKey, {
    avatarID: 'avatar_1',
    chainIndex: 5,
    kind: 'reward',
    ordinal: 0,
    scopeID: 'node_1',
    scopeType: 'world_map_node',
  });

  const expectedItem = rollItemFromStream(loot, { nodeTier: 2 }, stream);

  expect(items).toStrictEqual([
    {
      affixes: expectedItem.affixes,
      baseID: expectedItem.baseID,
      chainIndex: 5,
      contentVersion: expectedItem.contentVersion,
      keyVersion: 1,
      ordinal: 0,
      rarityID: expectedItem.rarityID,
      scopeID: 'node_1',
      scopeType: 'world_map_node',
    },
  ]);
});

test('it rolls one item per reward fact, each at its own coordinate', async () => {
  const keyPair = await getTestServiceKeyPair();

  const items = await rollRewardItems(
    { keysServiceURL: resolveServiceURL('keys'), privateKey: keyPair.privateKey },
    {
      avatarID: 'avatar_1',
      keyVersion: 1,
      rewardFacts: [
        { chainIndex: 5, nodeTier: 1, ordinal: 0 },
        { chainIndex: 5, nodeTier: 1, ordinal: 1 },
      ],
      scopeID: 'node_1',
      scopeType: 'world_map_node',
      tables: createMockContentDocument().loot,
    },
  );

  expect(items).toHaveLength(2);
  expect(items.map((item) => item.ordinal)).toStrictEqual([0, 1]);
  expect(items[0]).not.toStrictEqual(items[1]);
});
