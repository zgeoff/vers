import { expect, onTestFinished, test } from 'bun:test';
import {
  createActivityRow,
  createAvatarRow,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { waitForSettlement } from './wait-for-settlement';

async function setupTest() {
  const testDB = await createTestDB();

  onTestFinished(() => testDB[Symbol.asyncDispose]());

  return { db: testDB.db };
}

test('it reads a pipeline with every checkpoint proved as settled', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, { appendedHead: 4, avatarId: avatar.id, verifiedHead: 4 });

  const settledMs = await waitForSettlement(ctx.db, 1000);

  expect(settledMs).toBeWithin(0, 1000);
});

test('it ignores the backlog of a held activity', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 4,
    avatarId: avatar.id,
    status: 'parked',
    verifiedHead: 1,
  });

  const settledMs = await waitForSettlement(ctx.db, 1000);

  expect(settledMs).toBeWithin(0, 1000);
});

test('it gives up when the backlog outlives the timeout', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, { appendedHead: 4, avatarId: avatar.id, verifiedHead: 1 });

  const settledMs = await waitForSettlement(ctx.db, 50);

  expect(settledMs).toBeUndefined();
});
