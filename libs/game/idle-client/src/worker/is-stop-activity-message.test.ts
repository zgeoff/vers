import { expect, test } from 'bun:test';
import { ClientMessageType } from '../types';
import { createStopActivityMessage } from './create-stop-activity-message';
import { isStopActivityMessage } from './is-stop-activity-message';

test('it recognizes a stop activity message', () => {
  expect(isStopActivityMessage(createStopActivityMessage('avatar_1', 'activity_1'))).toBeTrue();
});

test('it rejects a message of another type', () => {
  expect(isStopActivityMessage({ type: ClientMessageType.Initialize })).toBeFalse();
});
