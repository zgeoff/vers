import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { readAvatarProgress } from './read-avatar-progress';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test("it reads an avatar's level and XP total", async () => {
  await using ctx = await setupTest();

  const avatar = await createAvatarRow(ctx.db, { level: 3, xp: 120 });
  const progress = await readAvatarProgress(ctx.db, avatar.id);

  expect(progress).toStrictEqual({ level: 3, xp: 120 });
});

test('it returns null for an unknown avatar', async () => {
  await using ctx = await setupTest();

  const progress = await readAvatarProgress(ctx.db, 'avt_gone');

  expect(progress).toBeNull();
});
