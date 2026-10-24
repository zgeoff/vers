import { expect, test } from 'bun:test';
import { hexToBytes } from '@noble/hashes/utils.js';
import { buildPositionStream } from './build-position-stream';
import { ITEM_INTERPRETERS } from './item-interpreters';
import { rollItemFromStream } from './roll-item-from-stream';
import type { LootTables } from './types';

test.each(['1', '2'])(
  'it rolls content version %s tables in the frozen draw order those versions shipped with',
  (contentVersion) => {
    const tables: LootTables = {
      contentVersion,
      rarities: [
        { id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 },
        { id: 'magic', weight: 25, affixCountMin: 1, affixCountMax: 2 },
        { id: 'rare', weight: 5, affixCountMin: 2, affixCountMax: 2 },
      ],
      bases: [
        { id: 'placeholder-blade', weight: 60 },
        { id: 'placeholder-focus', weight: 40 },
      ],
      affixes: [
        { id: 'flat-power', groupID: 'power', weight: 3, valueMin: 1, valueMax: 10 },
        { id: 'pct-power', groupID: 'power', weight: 1, valueMin: 1, valueMax: 5 },
        { id: 'flat-guard', groupID: 'guard', weight: 3, valueMin: 1, valueMax: 10 },
        { id: 'pct-guard', groupID: 'guard', weight: 1, valueMin: 1, valueMax: 5 },
      ],
    };

    const stream = buildPositionStream(hexToBytes('11'.repeat(32)), {
      kind: 'reward',
      avatarID: 'avatar-1',
      scopeType: 'world_map_node',
      scopeID: 'node-1',
      chainIndex: 3,
      ordinal: 0,
    });

    expect(rollItemFromStream(ITEM_INTERPRETERS, tables, { nodeTier: 0 }, stream)).toStrictEqual({
      affixes: [{ affixID: 'flat-guard', groupID: 'guard', value: 1 }],
      baseID: 'placeholder-focus',
      contentVersion,
      rarityID: 'magic',
    });
  },
);

test('it rolls through the interpreter the tables content version names, not a newer one', () => {
  const tables: LootTables = {
    contentVersion: '1',
    rarities: [{ id: 'common', weight: 1, affixCountMin: 0, affixCountMax: 0 }],
    bases: [{ id: 'placeholder-blade', weight: 1 }],
    affixes: [],
  };

  const interpreters = {
    '1': () => ({
      affixes: [],
      baseID: 'old-order-base',
      contentVersion: '1',
      rarityID: 'common',
    }),
    '2': () => ({
      affixes: [],
      baseID: 'new-order-base',
      contentVersion: '2',
      rarityID: 'common',
    }),
  };

  const stream = buildPositionStream(hexToBytes('11'.repeat(32)), {
    kind: 'reward',
    avatarID: 'avatar-1',
    scopeType: 'world_map_node',
    scopeID: 'node-1',
    chainIndex: 3,
    ordinal: 0,
  });

  expect(rollItemFromStream(interpreters, tables, { nodeTier: 0 }, stream)).toStrictEqual({
    affixes: [],
    baseID: 'old-order-base',
    contentVersion: '1',
    rarityID: 'common',
  });
});

test('it rejects tables whose content version has no interpreter', () => {
  const tables: LootTables = {
    contentVersion: '7',
    rarities: [{ id: 'common', weight: 1, affixCountMin: 0, affixCountMax: 0 }],
    bases: [{ id: 'placeholder-blade', weight: 1 }],
    affixes: [],
  };

  const stream = buildPositionStream(hexToBytes('11'.repeat(32)), {
    kind: 'reward',
    avatarID: 'avatar-1',
    scopeType: 'world_map_node',
    scopeID: 'node-1',
    chainIndex: 3,
    ordinal: 0,
  });

  expect(() =>
    rollItemFromStream(ITEM_INTERPRETERS, tables, { nodeTier: 0 }, stream),
  ).toThrowWithMessage(Error, /no item interpreter for content version 7/u);
});
