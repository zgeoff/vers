import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createActivityRow } from '../test-utils/create-activity-row';
import { updateReplayBackoff } from './update-replay-backoff';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it backs a first failure off by 30 seconds and leaves the status alone', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, { appendedHead: 1, status: 'stopped' });

  const before = Date.now();

  const result = await updateReplayBackoff(ctx.db, { activityID: activity.id });

  expect(result).toStrictEqual({ backoffUntil: expect.toBeValidDate(), backoffs: 1 });
  expect(result?.backoffUntil).toBeBetween(new Date(before + 29_000), new Date(before + 31_000));

  const row = await ctx.db
    .selectFrom('activities')
    .select(['replayAttempts', 'status'])
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(row).toStrictEqual({ replayAttempts: 0, status: 'stopped' });
});

test('it doubles the wait on each consecutive failure', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, { appendedHead: 1, replayBackoffs: 3 });

  const before = Date.now();

  const result = await updateReplayBackoff(ctx.db, { activityID: activity.id });

  expect(result?.backoffs).toBe(4);
  expect(result?.backoffUntil).toBeBetween(new Date(before + 239_000), new Date(before + 241_000));
});

test('it caps the wait at 15 minutes', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, { appendedHead: 1, replayBackoffs: 12 });

  const before = Date.now();

  const result = await updateReplayBackoff(ctx.db, { activityID: activity.id });

  expect(result?.backoffUntil).toBeBetween(new Date(before + 899_000), new Date(before + 901_000));
});

test('it reports a missing activity as undefined', async () => {
  await using ctx = await setupTest();

  expect(updateReplayBackoff(ctx.db, { activityID: 'act_missing' })).resolves.toBeUndefined();
});
