import { expect, test } from 'bun:test';
import { createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { createAvatarRow } from './test-utils/create-avatar-row';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

// Each call acquires its own transaction-isolated handle from the same shared worker database
// (`@vers/service-test-utils/bun`'s default isolation). These two tests prove the rollback
// actually holds across test boundaries — order-dependent by design.

test('it creates an avatar visible within this test', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-activity', db: ctx.db });

  await createAvatarRow(ctx.db, { userId: viewer.user.id });

  const rows = await ctx.db.selectFrom('avatars').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it starts with no avatars left over from the previous test', async () => {
  await using ctx = await setupTest();

  const rows = await ctx.db.selectFrom('avatars').selectAll().execute();

  expect(rows).toBeEmpty();
});
