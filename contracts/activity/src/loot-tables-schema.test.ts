import { expect, test } from 'bun:test';
import type { LootTables } from '@vers/item-gen';
import { LootTablesSchema } from './loot-tables-schema';

const VALID_LOOT_TABLES = {
  contentVersion: '1',
  rarities: [{ id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 }],
  bases: [{ id: 'base-a', weight: 60 }],
  affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 }],
};

test('it accepts a coherent loot tables document', () => {
  const result = LootTablesSchema.safeParse(VALID_LOOT_TABLES);

  expect(result.success).toBeTrue();
});

test('it parses into the game type', () => {
  const loot: LootTables = LootTablesSchema.parse(VALID_LOOT_TABLES);

  expect(loot.contentVersion).toBe('1');
});

test('it rejects a rarity missing a required field', () => {
  const result = LootTablesSchema.safeParse({
    ...VALID_LOOT_TABLES,
    rarities: [{ id: 'common', weight: 70, affixCountMin: 0 }],
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['rarities', 0, 'affixCountMax'] }),
  );
});

test('it rejects an affix missing a required field', () => {
  const result = LootTablesSchema.safeParse({
    ...VALID_LOOT_TABLES,
    affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1 }],
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['affixes', 0, 'valueMax'] }),
  );
});

test('it rejects a zero rarity weight', () => {
  const result = LootTablesSchema.safeParse({
    contentVersion: '1',
    rarities: [{ id: 'common', weight: 0, affixCountMin: 0, affixCountMax: 0 }],
    bases: [{ id: 'base-a', weight: 60 }],
    affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 }],
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['rarities', 0, 'weight'] }),
  );
});

test('it rejects a fractional base weight', () => {
  const result = LootTablesSchema.safeParse({
    contentVersion: '1',
    rarities: [{ id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 }],
    bases: [{ id: 'base-a', weight: 60.5 }],
    affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 }],
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['bases', 0, 'weight'] }),
  );
});

test('it rejects an empty rarities table', () => {
  const result = LootTablesSchema.safeParse({
    contentVersion: '1',
    rarities: [],
    bases: [{ id: 'base-a', weight: 60 }],
    affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 }],
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['rarities'] }));
});

test('it rejects an empty bases table', () => {
  const result = LootTablesSchema.safeParse({
    contentVersion: '1',
    rarities: [{ id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 }],
    bases: [],
    affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 }],
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['bases'] }));
});

test('it rejects an empty affixes table', () => {
  const result = LootTablesSchema.safeParse({
    contentVersion: '1',
    rarities: [{ id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 }],
    bases: [{ id: 'base-a', weight: 60 }],
    affixes: [],
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['affixes'] }));
});

test('it rejects a rarity whose affix count min exceeds its max', () => {
  const result = LootTablesSchema.safeParse({
    contentVersion: '1',
    rarities: [{ id: 'rare', weight: 5, affixCountMin: 3, affixCountMax: 2 }],
    bases: [{ id: 'base-a', weight: 60 }],
    affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 }],
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['rarities', 0, 'affixCountMax'] }),
  );
});

test('it rejects a negative affix count', () => {
  const result = LootTablesSchema.safeParse({
    contentVersion: '1',
    rarities: [{ id: 'common', weight: 70, affixCountMin: -1, affixCountMax: 0 }],
    bases: [{ id: 'base-a', weight: 60 }],
    affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 }],
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['rarities', 0, 'affixCountMin'] }),
  );
});

test('it rejects an affix whose value min exceeds its max', () => {
  const result = LootTablesSchema.safeParse({
    contentVersion: '1',
    rarities: [{ id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 }],
    bases: [{ id: 'base-a', weight: 60 }],
    affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 11, valueMax: 10 }],
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['affixes', 0, 'valueMax'] }),
  );
});

test('it rejects a non-finite affix bound', () => {
  const result = LootTablesSchema.safeParse({
    contentVersion: '1',
    rarities: [{ id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 }],
    bases: [{ id: 'base-a', weight: 60 }],
    affixes: [
      {
        id: 'affix-a',
        groupID: 'group-a',
        weight: 3,
        valueMin: 1,
        valueMax: Number.POSITIVE_INFINITY,
      },
    ],
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['affixes', 0, 'valueMax'] }),
  );
});

test('it rejects duplicate rarity ids', () => {
  const result = LootTablesSchema.safeParse({
    contentVersion: '1',
    rarities: [
      { id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 },
      { id: 'common', weight: 25, affixCountMin: 1, affixCountMax: 2 },
    ],
    bases: [{ id: 'base-a', weight: 60 }],
    affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 }],
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['rarities', 1, 'id'] }),
  );
});

test('it rejects duplicate base ids', () => {
  const result = LootTablesSchema.safeParse({
    contentVersion: '1',
    rarities: [{ id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 }],
    bases: [
      { id: 'base-a', weight: 60 },
      { id: 'base-a', weight: 40 },
    ],
    affixes: [{ id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 }],
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['bases', 1, 'id'] }),
  );
});

test('it rejects duplicate affix ids', () => {
  const result = LootTablesSchema.safeParse({
    contentVersion: '1',
    rarities: [{ id: 'common', weight: 70, affixCountMin: 0, affixCountMax: 0 }],
    bases: [{ id: 'base-a', weight: 60 }],
    affixes: [
      { id: 'affix-a', groupID: 'group-a', weight: 3, valueMin: 1, valueMax: 10 },
      { id: 'affix-a', groupID: 'group-b', weight: 1, valueMin: 1, valueMax: 5 },
    ],
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['affixes', 1, 'id'] }),
  );
});
