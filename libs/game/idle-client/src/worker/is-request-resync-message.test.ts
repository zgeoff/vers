import { expect, test } from 'bun:test';
import { ClientMessageType } from '../types';
import { createRequestResyncMessage } from './create-request-resync-message';
import { isRequestResyncMessage } from './is-request-resync-message';

test('it recognizes a request resync message', () => {
  expect(isRequestResyncMessage(createRequestResyncMessage('avatar_1'))).toBeTrue();
});

test('it rejects a message of another type', () => {
  expect(isRequestResyncMessage({ type: ClientMessageType.Initialize })).toBeFalse();
});
