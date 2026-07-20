import { expect, test } from 'bun:test';
import { readPendingStopIntent } from './read-pending-stop-intent';
import { removePendingStopIntent } from './remove-pending-stop-intent';
import { writePendingStopIntent } from './write-pending-stop-intent';

test('it removes the held intent for the delivered activity', async () => {
  await writePendingStopIntent({ activityID: 'activity_1', avatarID: 'avatar_1' });
  await removePendingStopIntent('activity_1');

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();
});

test('it keeps a fresher intent held for a different activity', async () => {
  await writePendingStopIntent({ activityID: 'activity_2', avatarID: 'avatar_1' });
  await removePendingStopIntent('activity_1');

  const intent = await readPendingStopIntent();

  expect(intent).toStrictEqual({
    activityID: 'activity_2',
    avatarID: 'avatar_1',
  });
});

test('it tolerates no intent being held', async () => {
  await removePendingStopIntent('activity_1');

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();
});
