import { expect, test } from 'bun:test';
import { ClientMessageType } from '../types';
import { createStartActivityMessage } from './create-start-activity-message';
import { isStartActivityMessage } from './is-start-activity-message';

test('it recognizes a start activity message', () => {
  const message = createStartActivityMessage({
    avatarID: 'avatar_1',
    requestID: 'request_1',
    scopeID: 'scope_1',
    scopeType: 'world_map_node',
  });

  expect(isStartActivityMessage(message)).toBeTrue();
});

test('it rejects a message of another type', () => {
  expect(isStartActivityMessage({ type: ClientMessageType.Initialize })).toBeFalse();
});
