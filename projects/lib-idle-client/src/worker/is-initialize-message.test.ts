import { expect, test } from 'bun:test';
import { createMockActivityData, createMockAvatarData } from '@vers/idle-core';
import type { InitializeMessage, SetActivityMessage } from '../types';
import { ClientMessageType } from '../types';
import { isInitializeMessage } from './is-initialize-message';

test('it returns true if it is an initialize message', () => {
  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  expect(isInitializeMessage(message)).toBeTrue();
});

test('it returns false if it is not an initialize message', () => {
  const avatar = createMockAvatarData();
  const activity = createMockActivityData();

  const message: SetActivityMessage = {
    activity,
    avatar,
    type: ClientMessageType.SetActivity,
  };

  expect(isInitializeMessage(message)).toBeFalse();
});
