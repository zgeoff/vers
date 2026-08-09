import { expect, test } from 'bun:test';
import { hexToBytes } from '@noble/hashes/utils.js';
import { buildPositionStream } from './build-position-stream';
import { rollItemFromStream } from './roll-item-from-stream';
import type { LootTables } from './types';

test('it reproduces the frozen golden item for a fixed key and coordinate', () => {
  const tables: LootTables = {
    contentVersion: '1',
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

  expect(rollItemFromStream(tables, { nodeTier: 0 }, stream)).toMatchInlineSnapshot(`
    {
      "affixes": [
        {
          "affixID": "flat-guard",
          "groupID": "guard",
          "value": 1,
        },
      ],
      "baseID": "placeholder-focus",
      "contentVersion": "1",
      "rarityID": "magic",
    }
  `);
});

test('it reproduces the frozen golden rare item with both affix groups', () => {
  const tables: LootTables = {
    contentVersion: '1',
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
    ordinal: 41,
  });

  expect(rollItemFromStream(tables, { nodeTier: 0 }, stream)).toMatchInlineSnapshot(`
    {
      "affixes": [
        {
          "affixID": "pct-guard",
          "groupID": "guard",
          "value": 4,
        },
        {
          "affixID": "pct-power",
          "groupID": "power",
          "value": 1,
        },
      ],
      "baseID": "placeholder-blade",
      "contentVersion": "1",
      "rarityID": "rare",
    }
  `);
});

test('it rolls zero affixes for a common item', () => {
  const tables: LootTables = {
    contentVersion: '1',
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
    ordinal: 1,
  });

  expect(rollItemFromStream(tables, { nodeTier: 0 }, stream)).toStrictEqual({
    affixes: [],
    baseID: 'placeholder-blade',
    contentVersion: '1',
    rarityID: 'common',
  });
});

test('it rolls identical items from equal inputs', () => {
  const tables: LootTables = {
    contentVersion: '1',
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

  const first = buildPositionStream(hexToBytes('11'.repeat(32)), {
    kind: 'reward',
    avatarID: 'avatar-1',
    scopeType: 'world_map_node',
    scopeID: 'node-1',
    chainIndex: 3,
    ordinal: 9,
  });

  const second = buildPositionStream(hexToBytes('11'.repeat(32)), {
    kind: 'reward',
    avatarID: 'avatar-1',
    scopeType: 'world_map_node',
    scopeID: 'node-1',
    chainIndex: 3,
    ordinal: 9,
  });

  expect(rollItemFromStream(tables, { nodeTier: 0 }, first)).toStrictEqual(
    rollItemFromStream(tables, { nodeTier: 0 }, second),
  );
});

test('it rolls a different item at a different ordinal', () => {
  const tables: LootTables = {
    contentVersion: '1',
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

  const first = buildPositionStream(hexToBytes('11'.repeat(32)), {
    kind: 'reward',
    avatarID: 'avatar-1',
    scopeType: 'world_map_node',
    scopeID: 'node-1',
    chainIndex: 3,
    ordinal: 0,
  });

  const second = buildPositionStream(hexToBytes('11'.repeat(32)), {
    kind: 'reward',
    avatarID: 'avatar-1',
    scopeType: 'world_map_node',
    scopeID: 'node-1',
    chainIndex: 3,
    ordinal: 3,
  });

  expect(rollItemFromStream(tables, { nodeTier: 0 }, first)).not.toStrictEqual(
    rollItemFromStream(tables, { nodeTier: 0 }, second),
  );
});

test('it rejects a malformed context', () => {
  const tables: LootTables = {
    contentVersion: '1',
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

  expect(() => rollItemFromStream(tables, { nodeTier: -1 }, stream)).toThrowWithMessage(
    Error,
    /nodeTier must be a non-negative integer/,
  );
});
