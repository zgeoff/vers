import { expect, test } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import { ClientMessageType } from '../types';
import { createSetFailureActionMessage } from './create-set-failure-action-message';

test('it creates a set failure action message', () => {
  const message = createSetFailureActionMessage(ActivityFailureAction.Retry);

  expect(message).toStrictEqual({
    failureAction: ActivityFailureAction.Retry,
    type: ClientMessageType.SetFailureAction,
  });
});
