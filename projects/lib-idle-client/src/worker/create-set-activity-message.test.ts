import { createMockActivityData, createMockAvatarData } from '@vers/idle-core';
import { expect, test } from 'vitest';
import { ClientMessageType } from '../types';
import { createSetActivityMessage } from './create-set-activity-message';

test('it creates a set activity message', () => {
  const activity = createMockActivityData();
  const avatar = createMockAvatarData();

  const message = createSetActivityMessage(activity, avatar);

  expect(message).toStrictEqual({
    activity,
    avatar,
    type: ClientMessageType.SetActivity,
  });
});
