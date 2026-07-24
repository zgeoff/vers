import { expect, test } from 'bun:test';
import { readPendingStartIntent } from './read-pending-start-intent';
import { writePendingStartIntent } from './write-pending-start-intent';

test('it overwrites the previously held intent', async () => {
  await writePendingStartIntent({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    scopeID: '2_0',
    scopeType: 'mission',
  });

  await writePendingStartIntent({
    activityID: 'activity_2',
    avatarID: 'avatar_1',
    scopeID: '3_0',
    scopeType: 'mission',
  });

  const intent = await readPendingStartIntent();

  expect(intent).toStrictEqual({
    activityID: 'activity_2',
    avatarID: 'avatar_1',
    scopeID: '3_0',
    scopeType: 'mission',
  });
});
