import { expect, test } from 'bun:test';
import { WorkerMessageType } from '../types';
import { createStartStatusMessage } from './create-start-status-message';

test('it creates a start status message', () => {
  const message = createStartStatusMessage('request_1', { kind: 'failed' });

  expect(message).toStrictEqual({
    requestID: 'request_1',
    status: { kind: 'failed' },
    type: WorkerMessageType.StartStatus,
  });
});
