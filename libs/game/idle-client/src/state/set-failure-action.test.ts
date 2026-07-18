import { expect, test } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import { setFailureAction } from './set-failure-action';
import { useIdleStore } from './use-idle-store';

test('it replaces the stored failure action wholesale', () => {
  setFailureAction(ActivityFailureAction.Retry);
  expect(useIdleStore.getState().failureAction).toBe(ActivityFailureAction.Retry);
  setFailureAction(ActivityFailureAction.Abort);
  expect(useIdleStore.getState().failureAction).toBe(ActivityFailureAction.Abort);
});
