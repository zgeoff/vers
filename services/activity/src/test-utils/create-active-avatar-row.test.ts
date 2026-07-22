import { expect, test } from 'bun:test';
import { createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { createActiveAvatarRow } from './create-active-avatar-row';
import { createAvatarRow } from './create-avatar-row';

test("it inserts an active_avatars row naming the given avatar as the given user's active one", async () => {
  await using testDB = await createTestDB();

  const user = await createTestUser(testDB.db);
  const avatar = await createAvatarRow(testDB.db, { userId: user.user.id });

  const row = await createActiveAvatarRow(testDB.db, {
    avatarId: avatar.id,
    userId: user.user.id,
  });

  expect(row).toMatchObject({ avatarId: avatar.id, userId: user.user.id });
});
