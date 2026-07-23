import { expect, test } from 'bun:test';
import { createTestDB } from '../create-test-db';
import { createTestUser } from '../create-test-user';
import { createActivityRow } from './create-activity-row';
import { createAvatarRow } from './create-avatar-row';

test('it inserts an activity head row for the given avatar', async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);
  const avatar = await createAvatarRow(testDB.db, { userId: user.user.id });
  const activity = await createActivityRow(testDB.db, { avatarId: avatar.id });

  expect(activity).toMatchObject({ avatarId: avatar.id, status: 'active' });
});

test('it applies overrides on top of the faker-generated defaults', async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);
  const avatar = await createAvatarRow(testDB.db, { userId: user.user.id });
  const activity = await createActivityRow(testDB.db, { avatarId: avatar.id, status: 'stopped' });

  expect(activity).toMatchObject({ avatarId: avatar.id, status: 'stopped' });
});
