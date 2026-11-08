import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createActivityRow } from '../test-utils/create-activity-row';
import { readReplayProgress } from './read-replay-progress';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test("it reads an activity's replay cursors, retry counters and settled XP", async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, {
    appendedHead: 6,
    replayAttempts: 2,
    replayBackoffs: 3,
    replayBackoffUntil: new Date('2026-03-04T05:06:07.000Z'),
    settledXp: 75,
    verifiedAt: new Date('2026-03-04T05:01:00.000Z'),
    verifiedHead: 4,
  });

  const progress = await readReplayProgress(ctx.db, activity.id);

  expect(progress).toStrictEqual({
    appendedHead: 6,
    replayAttempts: 2,
    replayBackoffs: 3,
    replayBackoffUntil: new Date('2026-03-04T05:06:07.000Z'),
    settledXP: 75,
    verifiedAt: new Date('2026-03-04T05:01:00.000Z'),
    verifiedHead: 4,
  });
});

test('it returns null for an unknown activity', async () => {
  await using ctx = await setupTest();

  const progress = await readReplayProgress(ctx.db, 'act_gone');

  expect(progress).toBeNull();
});
