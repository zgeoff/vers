import { expect, test } from 'bun:test';
import { createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { createAvatarRow } from './create-avatar-row';

test('it inserts an avatar row owned by the given user', async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);
  const avatar = await createAvatarRow(testDB.db, { userId: user.user.id });

  const row = await testDB.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', avatar.id)
    .executeTakeFirstOrThrow();

  expect(row.userId).toBe(user.user.id);
});

test('it applies overrides on top of the faker-generated defaults', async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);

  const avatar = await createAvatarRow(testDB.db, {
    name: 'Foreign',
    userId: user.user.id,
  });

  expect(avatar).toMatchObject({ name: 'Foreign' });
});
