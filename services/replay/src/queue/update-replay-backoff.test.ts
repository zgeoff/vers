import { expect, test } from 'bun:test';
import { readActivityStatus } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import invariant from 'tiny-invariant';
import { createActivityRow } from '../test-utils/create-activity-row';
import { readReplayProgress } from './read-replay-progress';
import { updateReplayBackoff } from './update-replay-backoff';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it backs a first failure off by 30 seconds and leaves the status alone', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, { appendedHead: 1, status: 'stopped' });

  const before = Date.now();

  const result = await updateReplayBackoff(ctx.db, { activityID: activity.id, verifiedHead: 0 });

  expect(result).toStrictEqual({ backoffUntil: expect.toBeValidDate(), backoffs: 1 });
  expect(result?.backoffUntil).toBeBetween(new Date(before + 29_000), new Date(before + 31_000));

  invariant(result, 'the first failure returns its backoff');

  const status = await readActivityStatus(ctx.db, activity.id);
  const progress = await readReplayProgress(ctx.db, activity.id);

  expect(status).toStrictEqual({ parkedFrom: null, status: 'stopped' });

  expect(progress).toStrictEqual({
    appendedHead: 1,
    replayAttempts: 0,
    replayBackoffs: 1,
    replayBackoffUntil: result.backoffUntil,
    settledXP: 0,
    verifiedAt: null,
    verifiedHead: 0,
  });
});

test('it doubles the wait on each consecutive failure', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, { appendedHead: 1, replayBackoffs: 3 });

  const before = Date.now();

  const result = await updateReplayBackoff(ctx.db, { activityID: activity.id, verifiedHead: 0 });

  expect(result?.backoffs).toBe(4);
  expect(result?.backoffUntil).toBeBetween(new Date(before + 239_000), new Date(before + 241_000));
});

test('it caps the wait at 15 minutes', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, { appendedHead: 1, replayBackoffs: 12 });

  const before = Date.now();

  const result = await updateReplayBackoff(ctx.db, { activityID: activity.id, verifiedHead: 0 });

  expect(result?.backoffUntil).toBeBetween(new Date(before + 899_000), new Date(before + 901_000));
});

test('it skips the backoff when another worker already verified past the guarded head', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, { appendedHead: 3, verifiedHead: 3 });
  const result = await updateReplayBackoff(ctx.db, { activityID: activity.id, verifiedHead: 1 });

  expect(result).toBeUndefined();

  const row = await ctx.db
    .selectFrom('activities')
    .select(['replayBackoffUntil', 'replayBackoffs'])
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(row).toStrictEqual({ replayBackoffUntil: null, replayBackoffs: 0 });
});

test('it reports a missing activity as undefined', async () => {
  await using ctx = await setupTest();

  expect(
    updateReplayBackoff(ctx.db, { activityID: 'act_missing', verifiedHead: 0 }),
  ).resolves.toBeUndefined();
});
