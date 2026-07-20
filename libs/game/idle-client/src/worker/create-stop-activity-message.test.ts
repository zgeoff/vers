import { expect, test } from 'bun:test';
import { ClientMessageType } from '../types';
import { createStopActivityMessage } from './create-stop-activity-message';

test('it creates a stop activity message', () => {
  const message = createStopActivityMessage('avatar_1', 'activity_1');

  expect(message).toStrictEqual({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    type: ClientMessageType.StopActivity,
  });
});
