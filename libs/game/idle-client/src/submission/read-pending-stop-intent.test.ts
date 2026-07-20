import { expect, test } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import { readFailureActionCache } from './read-failure-action-cache';
import { readPendingStopIntent } from './read-pending-stop-intent';
import { writeFailureActionCache } from './write-failure-action-cache';
import { writePendingStopIntent } from './write-pending-stop-intent';

test('it returns undefined when no stop is held', async () => {
  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();
});

test('it returns the held intent', async () => {
  await writePendingStopIntent({ activityID: 'activity_1', avatarID: 'avatar_1' });

  const intent = await readPendingStopIntent();

  expect(intent).toStrictEqual({ activityID: 'activity_1', avatarID: 'avatar_1' });
});

test('it coexists with the failure-action cache in the shared preferences store', async () => {
  await writeFailureActionCache({
    avatarID: 'avatar_1',
    dirty: false,
    failureAction: ActivityFailureAction.Retry,
  });

  await writePendingStopIntent({ activityID: 'activity_1', avatarID: 'avatar_1' });

  const intent = await readPendingStopIntent();

  expect(intent).toStrictEqual({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
  });

  const cached = await readFailureActionCache();

  expect(cached).toStrictEqual({
    avatarID: 'avatar_1',
    dirty: false,
    failureAction: ActivityFailureAction.Retry,
  });
});
