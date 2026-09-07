import { expect, test } from 'bun:test';
import { createMockLiveRun } from './create-mock-live-run';

test('it builds a default live run', () => {
  expect(createMockLiveRun()).toStrictEqual({
    avatarID: expect.toStartWith('avatar_'),
    id: expect.toStartWith('activity_'),
    scopeID: expect.toBeString(),
    scopeType: 'world_map_node',
  });
});

test('it applies overrides on top of the defaults', () => {
  expect(createMockLiveRun({ id: 'activity_1', scopeID: '0_0' })).toStrictEqual({
    avatarID: expect.toStartWith('avatar_'),
    id: 'activity_1',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });
});
