import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setCheckpointStreamError } from './set-checkpoint-stream-error';
import { useCheckpointStreamError } from './use-checkpoint-stream-error';

test('it provides checkpoint stream error state', () => {
  setCheckpointStreamError({ activityID: 'activity_1', reason: 'broken-chain-link' });

  const hook = renderHook(() => useCheckpointStreamError());

  expect(hook.result.current).toStrictEqual({
    activityID: 'activity_1',
    reason: 'broken-chain-link',
  });
});
