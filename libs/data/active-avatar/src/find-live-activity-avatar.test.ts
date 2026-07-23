import { expect, test } from 'bun:test';
import {
  createActivityRow,
  createAvatarRow,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { findLiveActivityAvatar } from './find-live-activity-avatar';

test('it returns the id and name of the avatar owning the live activity', async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);
  const avatar = await createAvatarRow(testDB.db, { name: 'Runner', userId: user.user.id });

  await createActivityRow(testDB.db, { avatarId: avatar.id, status: 'active' });

  expect(findLiveActivityAvatar(testDB.db, user.user.id)).resolves.toStrictEqual({
    id: avatar.id,
    name: 'Runner',
  });
});

test('it returns null when the user has no activity at all', async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);

  expect(findLiveActivityAvatar(testDB.db, user.user.id)).resolves.toBeNull();
});

test('it returns null when the user only has a non-active run', async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);
  const avatar = await createAvatarRow(testDB.db, { userId: user.user.id });

  await createActivityRow(testDB.db, { avatarId: avatar.id, status: 'stopped' });

  expect(findLiveActivityAvatar(testDB.db, user.user.id)).resolves.toBeNull();
});
