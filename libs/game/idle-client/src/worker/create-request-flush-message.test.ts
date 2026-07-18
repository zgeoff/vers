import { expect, test } from 'bun:test';
import { ClientMessageType } from '../types';
import { createRequestFlushMessage } from './create-request-flush-message';

test('it creates a request flush message', () => {
  const message = createRequestFlushMessage('activity_1', 'request_1');

  expect(message).toStrictEqual({
    activityID: 'activity_1',
    requestID: 'request_1',
    type: ClientMessageType.RequestFlush,
  });
});
