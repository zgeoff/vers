import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { readAvatarItems } from './read-avatar-items';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test("it reads an avatar's minted items in reward-coordinate order", async () => {
  await using ctx = await setupTest();

  const avatar = await createAvatarRow(ctx.db);
  const other = await createAvatarRow(ctx.db);

  await ctx.db
    .insertInto('avatarItems')
    .values([
      {
        affixes: [],
        avatarId: avatar.id,
        baseId: 'base_axe',
        chainIndex: 8,
        contentVersion: '2',
        keyVersion: 1,
        ordinal: 0,
        rarityId: 'common',
        scopeId: '1_2',
        scopeType: 'world_map_node',
      },
      {
        affixes: [],
        avatarId: avatar.id,
        baseId: 'base_bow',
        chainIndex: 3,
        contentVersion: '2',
        keyVersion: 1,
        ordinal: 1,
        rarityId: 'rare',
        scopeId: '1_2',
        scopeType: 'world_map_node',
      },
      {
        affixes: [],
        avatarId: other.id,
        baseId: 'base_club',
        chainIndex: 1,
        contentVersion: '2',
        keyVersion: 1,
        ordinal: 0,
        rarityId: 'common',
        scopeId: '1_2',
        scopeType: 'world_map_node',
      },
    ])
    .execute();

  const items = await readAvatarItems(ctx.db, avatar.id);

  expect(items.map((item) => item.baseId)).toStrictEqual(['base_bow', 'base_axe']);
});

test('it reads no items for an avatar with none minted', async () => {
  await using ctx = await setupTest();

  const avatar = await createAvatarRow(ctx.db);
  const items = await readAvatarItems(ctx.db, avatar.id);

  expect(items).toBeEmpty();
});
