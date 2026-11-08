import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { readAvatarGrants } from './read-avatar-grants';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test("it reads an avatar's own grants", async () => {
  await using ctx = await setupTest();

  const avatar = await createAvatarRow(ctx.db);
  const other = await createAvatarRow(ctx.db);

  await ctx.db
    .insertInto('avatarGrants')
    .values([
      { avatarId: avatar.id, key: '2_0', kind: 'first_clear' },
      { avatarId: avatar.id, key: '1_0', kind: 'first_clear' },
      { avatarId: other.id, key: '1_0', kind: 'first_clear' },
    ])
    .execute();

  const grants = await readAvatarGrants(ctx.db, avatar.id);

  expect(grants).toStrictEqual([
    { avatarId: avatar.id, createdAt: expect.toBeValidDate(), key: '1_0', kind: 'first_clear' },
    { avatarId: avatar.id, createdAt: expect.toBeValidDate(), key: '2_0', kind: 'first_clear' },
  ]);
});

test('it reads no grants for an avatar with none', async () => {
  await using ctx = await setupTest();

  const avatar = await createAvatarRow(ctx.db);
  const grants = await readAvatarGrants(ctx.db, avatar.id);

  expect(grants).toBeEmpty();
});
