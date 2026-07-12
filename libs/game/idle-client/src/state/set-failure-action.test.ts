import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { ActivityFailureAction } from '@vers/idle-core';
import { setFailureAction } from './set-failure-action';
import { useFailureActionStore } from './use-failure-action-store';

test('it updates the failure action state', () => {
  setFailureAction(ActivityFailureAction.Retry);

  const hook = renderHook(() => useFailureActionStore((state) => state.failureAction));

  expect(hook.result.current).toBe(ActivityFailureAction.Retry);
});
