import { expect, test } from 'bun:test';
import { createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { createActivityRow } from './create-activity-row';
import { createAvatarRow } from './create-avatar-row';

test('it inserts an activity row for a given avatar', async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);
  const avatar = await createAvatarRow(testDB.db, { userId: user.user.id });
  const activity = await createActivityRow(testDB.db, { avatarId: avatar.id });

  const row = await testDB.db
    .selectFrom('activities')
    .selectAll()
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(row.avatarId).toBe(avatar.id);
});

test('it applies overrides on top of the faker-generated defaults', async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);
  const avatar = await createAvatarRow(testDB.db, { userId: user.user.id });
  const activity = await createActivityRow(testDB.db, { avatarId: avatar.id, status: 'stopped' });

  expect(activity).toMatchObject({ avatarId: avatar.id, status: 'stopped' });
});
