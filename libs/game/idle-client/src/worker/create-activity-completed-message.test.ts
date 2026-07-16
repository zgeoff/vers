import { expect, test } from 'bun:test';
import { WorkerMessageType } from '../types';
import { createActivityCompletedMessage } from './create-activity-completed-message';

test('it creates an activity completed message', () => {
  const message = createActivityCompletedMessage('activity_1');

  expect(message).toStrictEqual({
    activityID: 'activity_1',
    type: WorkerMessageType.ActivityCompleted,
  });
});
