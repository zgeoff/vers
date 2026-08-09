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
