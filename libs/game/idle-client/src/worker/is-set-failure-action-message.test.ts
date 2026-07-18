import { expect, test } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import type { InitializeMessage, SetFailureActionMessage } from '../types';
import { ClientMessageType } from '../types';
import { isSetFailureActionMessage } from './is-set-failure-action-message';

test('it returns true if it is a set failure action message', () => {
  const message: SetFailureActionMessage = {
    avatarID: 'avatar-1',
    failureAction: ActivityFailureAction.Retry,
    type: ClientMessageType.SetFailureAction,
  };

  expect(isSetFailureActionMessage(message)).toBeTrue();
});

test('it returns false if it is not a set failure action message', () => {
  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  expect(isSetFailureActionMessage(message)).toBeFalse();
});
