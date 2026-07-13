import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createActivityRow } from '../test-utils/create-activity-row';
import { updateReplayAttempts } from './update-replay-attempts';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it counts a failed replay against the activity', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, { appendedHead: 1 });
  const result = await updateReplayAttempts(ctx.db, { activityID: activity.id });

  expect(result).toStrictEqual({ attempts: 1, quarantined: false });
});

test('it quarantines the activity at max attempts', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, { appendedHead: 1, replayAttempts: 2 });
  const result = await updateReplayAttempts(ctx.db, { activityID: activity.id, maxAttempts: 3 });

  expect(result).toStrictEqual({ attempts: 3, quarantined: true });

  const row = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(row.status).toBe('quarantined');
});

test('it reports a missing activity as undefined', async () => {
  await using ctx = await setupTest();

  const result = await updateReplayAttempts(ctx.db, { activityID: 'act_missing' });

  expect(result).toBeUndefined();
});
