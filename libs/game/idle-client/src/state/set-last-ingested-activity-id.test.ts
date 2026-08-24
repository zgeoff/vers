import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setLastIngestedActivityID } from './set-last-ingested-activity-id';
import { useLastIngestedActivityID } from './use-last-ingested-activity-id';

test('it records the ingested activity for selectors to read', () => {
  setLastIngestedActivityID('activity_1');

  const hook = renderHook(() => useLastIngestedActivityID());

  expect(hook.result.current).toBe('activity_1');
});
