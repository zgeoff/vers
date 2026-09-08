import { expect, test } from 'bun:test';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { buildPositionStream, rollItemFromStream } from '@vers/item-gen';
import { deriveAvatarKey } from '@vers/roll-crypto';
import { rollRewardItems } from './roll-reward-items';

test('it rolls no items for an empty fact list', () => {
  const rollKey = deriveAvatarKey({
    avatarID: 'avatar_1',
    keyVersion: 1,
    population: 'trade',
    root: sha256(utf8ToBytes('vers-mock-root|trade|1')),
  });

  const items = rollRewardItems(rollKey, {
    avatarID: 'avatar_1',
    keyVersion: 1,
    rewardFacts: [],
    scopeID: 'node_1',
    scopeType: 'world_map_node',
    tables: createMockContentDocument().loot,
  });

  expect(items).toStrictEqual([]);
});

test('it mints content identical to rolling the same coordinate directly', () => {
  const loot = createMockContentDocument().loot;

  const rollKey = deriveAvatarKey({
    avatarID: 'avatar_1',
    keyVersion: 1,
    population: 'trade',
    root: sha256(utf8ToBytes('vers-mock-root|trade|1')),
  });

  const items = rollRewardItems(rollKey, {
    avatarID: 'avatar_1',
    keyVersion: 1,
    rewardFacts: [{ chainIndex: 5, nodeTier: 2, ordinal: 0 }],
    scopeID: 'node_1',
    scopeType: 'world_map_node',
    tables: loot,
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

test('it rolls one item per reward fact, each at its own coordinate', () => {
  const rollKey = deriveAvatarKey({
    avatarID: 'avatar_1',
    keyVersion: 1,
    population: 'trade',
    root: sha256(utf8ToBytes('vers-mock-root|trade|1')),
  });

  const items = rollRewardItems(rollKey, {
    avatarID: 'avatar_1',
    keyVersion: 1,
    rewardFacts: [
      { chainIndex: 5, nodeTier: 1, ordinal: 0 },
      { chainIndex: 5, nodeTier: 1, ordinal: 1 },
    ],
    scopeID: 'node_1',
    scopeType: 'world_map_node',
    tables: createMockContentDocument().loot,
  });

  expect(items).toHaveLength(2);
  expect(items.map((item) => item.ordinal)).toStrictEqual([0, 1]);
  expect(items[0]).not.toStrictEqual(items[1]);
});
