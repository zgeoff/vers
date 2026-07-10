import { expect, test } from 'bun:test';
import { createMockActivityData, createMockAvatarData } from '@vers/idle-core';
import type { InitializeMessage, SetActivityMessage } from '../types';
import { ClientMessageType } from '../types';
import { isSetActivityMessage } from './is-set-activity-message';

test('it returns true if it is a set activity message', () => {
  const avatar = createMockAvatarData();
  const activity = createMockActivityData();

  const message: SetActivityMessage = {
    activity,
    avatar,
    type: ClientMessageType.SetActivity,
  };

  expect(isSetActivityMessage(message)).toBeTrue();
});

test('it returns false if it is not a set activity message', () => {
  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  expect(isSetActivityMessage(message)).toBeFalse();
});
