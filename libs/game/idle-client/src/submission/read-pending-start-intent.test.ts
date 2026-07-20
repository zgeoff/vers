import { expect, test } from 'bun:test';
import { readPendingStartIntent } from './read-pending-start-intent';
import { writePendingStartIntent } from './write-pending-start-intent';
import { writePendingStopIntent } from './write-pending-stop-intent';

test('it reads nothing when no intent is held', async () => {
  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toBeUndefined();
});

test('it reads the held intent without picking up other preference records', async () => {
  await writePendingStopIntent({ activityID: 'activity_stopped', avatarID: 'avatar_1' });

  await writePendingStartIntent({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    scopeID: 'scope_1',
    scopeType: 'mission',
  });

  const intent = await readPendingStartIntent();

  expect(intent).toStrictEqual({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    scopeID: 'scope_1',
    scopeType: 'mission',
  });
});
