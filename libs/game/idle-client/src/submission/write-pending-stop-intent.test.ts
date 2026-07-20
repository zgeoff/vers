import { expect, test } from 'bun:test';
import { readPendingStopIntent } from './read-pending-stop-intent';
import { writePendingStopIntent } from './write-pending-stop-intent';

test('it overwrites the previously held intent', async () => {
  await writePendingStopIntent({ activityID: 'activity_1', avatarID: 'avatar_1' });
  await writePendingStopIntent({ activityID: 'activity_2', avatarID: 'avatar_1' });

  const intent = await readPendingStopIntent();

  expect(intent).toStrictEqual({ activityID: 'activity_2', avatarID: 'avatar_1' });
});
