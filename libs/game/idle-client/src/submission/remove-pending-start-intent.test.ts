import { expect, test } from 'bun:test';
import { readPendingStartIntent } from './read-pending-start-intent';
import { removePendingStartIntent } from './remove-pending-start-intent';
import { writePendingStartIntent } from './write-pending-start-intent';

test('it removes the held intent for the delivered key', async () => {
  await writePendingStartIntent({
    avatarID: 'avatar_1',
    scopeID: 'scope_1',
    scopeType: 'world_map_node',
    startKey: 'continue_activity_1',
  });

  await removePendingStartIntent('continue_activity_1');

  const intent = await readPendingStartIntent();

  expect(intent).toBeUndefined();
});

test('it keeps a fresher intent held under a different key', async () => {
  await writePendingStartIntent({
    avatarID: 'avatar_1',
    scopeID: 'scope_2',
    scopeType: 'world_map_node',
    startKey: 'continue_activity_2',
  });

  await removePendingStartIntent('continue_activity_1');

  const intent = await readPendingStartIntent();

  expect(intent).toStrictEqual({
    avatarID: 'avatar_1',
    scopeID: 'scope_2',
    scopeType: 'world_map_node',
    startKey: 'continue_activity_2',
  });
});

test('it tolerates no intent being held', async () => {
  await removePendingStartIntent('continue_activity_1');

  const intent = await readPendingStartIntent();

  expect(intent).toBeUndefined();
});
