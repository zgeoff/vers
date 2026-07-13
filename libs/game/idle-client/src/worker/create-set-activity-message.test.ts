import { expect, test } from 'bun:test';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core';
import { ClientMessageType } from '../types';
import { createSetActivityMessage } from './create-set-activity-message';

test('it creates a set activity message', () => {
  const activity = createMockActivityInput();
  const avatar = createMockAvatarData();
  const message = createSetActivityMessage(activity, avatar);

  expect(message).toStrictEqual({
    activity,
    avatar,
    type: ClientMessageType.SetActivity,
  });
});
