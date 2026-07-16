import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setLastCompletedActivityID } from './set-last-completed-activity-id';
import { useLastCompletedActivityID } from './use-last-completed-activity-id';

test('it records the completed activity for selectors to read', () => {
  setLastCompletedActivityID('activity_1');

  const hook = renderHook(() => useLastCompletedActivityID());

  expect(hook.result.current).toBe('activity_1');
});
