import { expect, test } from 'bun:test';
import { ClientMessageType } from '../types';
import { createRequestFlushMessage } from './create-request-flush-message';
import { isRequestFlushMessage } from './is-request-flush-message';

test('it recognizes a request flush message', () => {
  expect(isRequestFlushMessage(createRequestFlushMessage('activity_1', 'request_1'))).toBeTrue();
});

test('it rejects a message of another type', () => {
  expect(isRequestFlushMessage({ type: ClientMessageType.Initialize })).toBeFalse();
});
