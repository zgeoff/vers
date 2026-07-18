import { expect, test } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import { WorkerMessageType } from '../types';
import { createFailureActionStatusMessage } from './create-failure-action-status-message';

test('it creates a failure-action status message', () => {
  const message = createFailureActionStatusMessage(ActivityFailureAction.Retry);

  expect(message).toStrictEqual({
    failureAction: ActivityFailureAction.Retry,
    type: WorkerMessageType.FailureActionStatus,
  });
});
