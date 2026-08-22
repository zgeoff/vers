import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createActivityRow } from '../test-utils/create-activity-row';
import { findReplayTarget } from './find-replay-target';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test("it loads the claimed activity's own replay fields", async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db, {
    appendedHead: 4,
    startChainIndex: 2,
    status: 'stopped',
    verifiedHead: 2,
  });

  const target = await findReplayTarget(ctx.db, activity.id);

  expect(target).toStrictEqual({
    activityID: activity.id,
    appendedHead: 4,
    replayAttempts: 0,
    startChainIndex: 2,
    status: 'stopped',
    verifiedHead: 2,
  });
});

test('it reports a gone activity as undefined', async () => {
  await using ctx = await setupTest();

  const target = await findReplayTarget(ctx.db, 'act_gone');

  expect(target).toBeUndefined();
});
