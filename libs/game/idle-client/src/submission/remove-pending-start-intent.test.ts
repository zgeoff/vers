import { expect, test } from 'bun:test';
import { readPendingStartIntent } from './read-pending-start-intent';
import { removePendingStartIntent } from './remove-pending-start-intent';
import { writePendingStartIntent } from './write-pending-start-intent';

test('it removes the intent naming the expected source row', async () => {
  await writePendingStartIntent({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    scopeID: 'scope_1',
    scopeType: 'mission',
  });

  await removePendingStartIntent('activity_1');

  expect(await readPendingStartIntent()).toBeUndefined();
});

test('it keeps a fresher intent written while the delivery was in flight', async () => {
  await writePendingStartIntent({
    activityID: 'activity_2',
    avatarID: 'avatar_1',
    scopeID: 'scope_2',
    scopeType: 'mission',
  });

  await removePendingStartIntent('activity_1');

  const intent = await readPendingStartIntent();

  expect(intent).toStrictEqual({
    activityID: 'activity_2',
    avatarID: 'avatar_1',
    scopeID: 'scope_2',
    scopeType: 'mission',
  });
});

test('it removes whatever intent is held when no source row is expected', async () => {
  await writePendingStartIntent({
    activityID: 'activity_3',
    avatarID: 'avatar_1',
    scopeID: 'scope_3',
    scopeType: 'mission',
  });

  await removePendingStartIntent();

  expect(await readPendingStartIntent()).toBeUndefined();
});

test('it tolerates removing when nothing is held', async () => {
  await removePendingStartIntent('activity_absent');

  expect(await readPendingStartIntent()).toBeUndefined();
});
