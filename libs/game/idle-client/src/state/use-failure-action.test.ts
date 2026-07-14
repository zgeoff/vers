import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { ActivityFailureAction } from '@vers/idle-core';
import { useFailureAction } from './use-failure-action';
import { useIdleStore } from './use-idle-store';

test('it provides failure action state', () => {
  useIdleStore.setState({ failureAction: ActivityFailureAction.Retry });

  const hook = renderHook(() => useFailureAction());

  expect(hook.result.current).toBe(ActivityFailureAction.Retry);
});
