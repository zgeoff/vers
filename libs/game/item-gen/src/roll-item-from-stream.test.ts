import { expect, test } from 'bun:test';
import { hexToBytes } from '@noble/hashes/utils.js';
import { buildPositionStream } from './build-position-stream';
import { rollItemFromStream } from './roll-item-from-stream';
import { tablesV1 } from './tables/tables-v1';

test('it reproduces the frozen golden item for a fixed key and coordinate', () => {
  const stream = buildPositionStream(hexToBytes('11'.repeat(32)), {
    kind: 'reward',
    avatarID: 'avatar-1',
    scopeType: 'world_map_node',
    scopeID: 'node-1',
    chainIndex: 3,
    ordinal: 0,
  });

  expect(rollItemFromStream(tablesV1, { nodeTier: 0 }, stream)).toStrictEqual({
    affixes: [{ affixID: 'flat-guard', groupID: 'guard', value: 1 }],
    baseID: 'placeholder-focus',
    contentVersion: '1',
    rarityID: 'magic',
  });
});

test('it reproduces the frozen golden rare item with both affix groups', () => {
  const stream = buildPositionStream(hexToBytes('11'.repeat(32)), {
    kind: 'reward',
    avatarID: 'avatar-1',
    scopeType: 'world_map_node',
    scopeID: 'node-1',
    chainIndex: 3,
    ordinal: 41,
  });

  expect(rollItemFromStream(tablesV1, { nodeTier: 0 }, stream)).toStrictEqual({
    affixes: [
      { affixID: 'pct-guard', groupID: 'guard', value: 4 },
      { affixID: 'pct-power', groupID: 'power', value: 1 },
    ],
    baseID: 'placeholder-blade',
    contentVersion: '1',
    rarityID: 'rare',
  });
});

test('it rolls zero affixes for a common item', () => {
  const stream = buildPositionStream(hexToBytes('11'.repeat(32)), {
    kind: 'reward',
    avatarID: 'avatar-1',
    scopeType: 'world_map_node',
    scopeID: 'node-1',
    chainIndex: 3,
    ordinal: 1,
  });

  expect(rollItemFromStream(tablesV1, { nodeTier: 0 }, stream)).toStrictEqual({
    affixes: [],
    baseID: 'placeholder-blade',
    contentVersion: '1',
    rarityID: 'common',
  });
});

test('it rolls identical items from equal inputs', () => {
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

  expect(rollItemFromStream(tablesV1, { nodeTier: 0 }, first)).toStrictEqual(
    rollItemFromStream(tablesV1, { nodeTier: 0 }, second),
  );
});

test('it rolls a different item at a different ordinal', () => {
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

  expect(rollItemFromStream(tablesV1, { nodeTier: 0 }, first)).not.toStrictEqual(
    rollItemFromStream(tablesV1, { nodeTier: 0 }, second),
  );
});

test('it rejects a malformed context', () => {
  const stream = buildPositionStream(hexToBytes('11'.repeat(32)), {
    kind: 'reward',
    avatarID: 'avatar-1',
    scopeType: 'world_map_node',
    scopeID: 'node-1',
    chainIndex: 3,
    ordinal: 0,
  });

  expect(() => rollItemFromStream(tablesV1, { nodeTier: -1 }, stream)).toThrowWithMessage(
    Error,
    /nodeTier must be a non-negative integer/,
  );
});
