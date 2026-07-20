import { expect, test } from 'bun:test';
import { ClientMessageType } from '../types';
import { createStartActivityMessage } from './create-start-activity-message';

test('it creates a start activity message', () => {
  const message = createStartActivityMessage({
    avatarID: 'avatar_1',
    requestID: 'request_1',
    scopeID: 'scope_1',
    scopeType: 'world_map_node',
  });

  expect(message).toStrictEqual({
    avatarID: 'avatar_1',
    requestID: 'request_1',
    scopeID: 'scope_1',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  });
});
