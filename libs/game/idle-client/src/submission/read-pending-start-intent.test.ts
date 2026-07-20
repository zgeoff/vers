import { expect, test } from 'bun:test';
import { readPendingStartIntent } from './read-pending-start-intent';
import { writePendingStartIntent } from './write-pending-start-intent';
import { writePendingStopIntent } from './write-pending-stop-intent';

test('it returns undefined when no start is held', async () => {
  const intent = await readPendingStartIntent();

  expect(intent).toBeUndefined();
});

test('it returns the held intent', async () => {
  await writePendingStartIntent({
    avatarID: 'avatar_1',
    scopeID: 'scope_1',
    scopeType: 'world_map_node',
    startKey: 'continue_activity_1',
  });

  const intent = await readPendingStartIntent();

  expect(intent).toStrictEqual({
    avatarID: 'avatar_1',
    scopeID: 'scope_1',
    scopeType: 'world_map_node',
    startKey: 'continue_activity_1',
  });
});

test('it never reads the stop intent sharing the preferences store', async () => {
  await writePendingStopIntent({ activityID: 'activity_1', avatarID: 'avatar_1' });

  const intent = await readPendingStartIntent();

  expect(intent).toBeUndefined();
});
