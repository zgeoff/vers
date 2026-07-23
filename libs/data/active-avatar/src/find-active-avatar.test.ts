import { expect, test } from 'bun:test';
import {
  createActiveAvatarRow,
  createAvatarRow,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { findActiveAvatar } from './find-active-avatar';

test("it returns the id and name of the user's active avatar", async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);
  const avatar = await createAvatarRow(testDB.db, { name: 'Chosen', userId: user.user.id });

  await createActiveAvatarRow(testDB.db, { avatarId: avatar.id, userId: user.user.id });

  expect(findActiveAvatar(testDB.db, user.user.id)).resolves.toStrictEqual({
    id: avatar.id,
    name: 'Chosen',
  });
});

test('it returns undefined when the user holds no selection', async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);

  expect(findActiveAvatar(testDB.db, user.user.id)).resolves.toBeUndefined();
});
