import { expect, test } from 'bun:test';
import { WorkerMessageType } from '../types';
import { createFlushCompletedMessage } from './create-flush-completed-message';

test('it creates a flush completed message', () => {
  const message = createFlushCompletedMessage('activity_1', 'request_1');

  expect(message).toStrictEqual({
    activityID: 'activity_1',
    requestID: 'request_1',
    type: WorkerMessageType.FlushCompleted,
  });

  // the literal pins the wire value so an enum-value change fails this test
  const wireValue: string = message.type;

  expect(wireValue).toBe('flush_completed');
});
