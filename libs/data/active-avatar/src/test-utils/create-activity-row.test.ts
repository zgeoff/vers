import { expect, test } from 'bun:test';
import { createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { createActivityRow } from './create-activity-row';
import { createAvatarRow } from './create-avatar-row';

test('it inserts an activity head row for the given avatar', async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);
  const avatar = await createAvatarRow(testDB.db, { userId: user.user.id });
  const activity = await createActivityRow(testDB.db, { avatarId: avatar.id, status: 'active' });

  expect(activity).toMatchObject({ avatarId: avatar.id, status: 'active' });
});
