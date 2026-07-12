import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { ActivityFailureAction } from '@vers/idle-core';
import { setFailureAction } from './set-failure-action';
import { useFailureAction } from './use-failure-action';

test('it provides failure action state', () => {
  setFailureAction(ActivityFailureAction.Retry);

  const hook = renderHook(() => useFailureAction());

  expect(hook.result.current).toBe(ActivityFailureAction.Retry);
});
