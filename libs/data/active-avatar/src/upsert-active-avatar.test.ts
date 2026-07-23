import { expect, test } from 'bun:test';
import {
  createActiveAvatarRow,
  createAvatarRow,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { upsertActiveAvatar } from './upsert-active-avatar';

test('it inserts a selection row when the user holds none', async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);
  const avatar = await createAvatarRow(testDB.db, { userId: user.user.id });

  await upsertActiveAvatar(testDB.db, user.user.id, avatar.id);

  const row = await testDB.db
    .selectFrom('activeAvatars')
    .selectAll()
    .where('userId', '=', user.user.id)
    .executeTakeFirstOrThrow();

  expect(row.avatarId).toBe(avatar.id);
});

test("it updates the existing row's avatar and updatedAt on conflict", async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);
  const first = await createAvatarRow(testDB.db, { userId: user.user.id });
  const second = await createAvatarRow(testDB.db, { userId: user.user.id });

  await createActiveAvatarRow(testDB.db, {
    avatarId: first.id,
    updatedAt: new Date('2020-01-01T00:00:00Z'),
    userId: user.user.id,
  });

  await upsertActiveAvatar(testDB.db, user.user.id, second.id);

  const row = await testDB.db
    .selectFrom('activeAvatars')
    .selectAll()
    .where('userId', '=', user.user.id)
    .executeTakeFirstOrThrow();

  expect(row.avatarId).toBe(second.id);
  expect(row.updatedAt.getTime()).toBeGreaterThan(new Date('2020-01-01T00:00:00Z').getTime());
});

test('it does not insert a second row on conflict', async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);
  const avatar = await createAvatarRow(testDB.db, { userId: user.user.id });

  await createActiveAvatarRow(testDB.db, { avatarId: avatar.id, userId: user.user.id });
  await upsertActiveAvatar(testDB.db, user.user.id, avatar.id);

  const rows = await testDB.db
    .selectFrom('activeAvatars')
    .selectAll()
    .where('userId', '=', user.user.id)
    .execute();

  expect(rows).toHaveLength(1);
});
