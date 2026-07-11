import { expect, test } from 'bun:test';
import { createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { createAvatarRow } from './create-avatar-row';

test('it inserts an avatar row owned by the given user', async () => {
  await using testDB = await createTestDB();

  const created = await createTestUser(testDB.db);

  const avatar = await createAvatarRow(testDB.db, { userId: created.user.id });

  const row = await testDB.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  expect(row.userId).toBe(created.user.id);
});

test('it applies overrides on top of the faker-generated defaults', async () => {
  await using testDB = await createTestDB();

  const created = await createTestUser(testDB.db);

  const avatar = await createAvatarRow(testDB.db, {
    class: 'scholar',
    name: 'Foreign',
    userId: created.user.id,
  });

  expect(avatar).toMatchObject({ class: 'scholar', name: 'Foreign' });
});
