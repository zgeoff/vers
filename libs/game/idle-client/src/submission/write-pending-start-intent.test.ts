import { expect, test } from 'bun:test';
import { readPendingStartIntent } from './read-pending-start-intent';
import { writePendingStartIntent } from './write-pending-start-intent';

test('it overwrites the previously held intent', async () => {
  await writePendingStartIntent({
    avatarID: 'avatar_1',
    scopeID: 'scope_1',
    scopeType: 'world_map_node',
    startKey: 'continue_activity_1',
  });

  await writePendingStartIntent({
    avatarID: 'avatar_1',
    scopeID: 'scope_2',
    scopeType: 'world_map_node',
    startKey: 'continue_activity_2',
  });

  const intent = await readPendingStartIntent();

  expect(intent).toStrictEqual({
    avatarID: 'avatar_1',
    scopeID: 'scope_2',
    scopeType: 'world_map_node',
    startKey: 'continue_activity_2',
  });
});
