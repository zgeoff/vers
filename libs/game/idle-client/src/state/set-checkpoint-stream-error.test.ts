import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setCheckpointStreamError } from './set-checkpoint-stream-error';
import { useIdleStore } from './use-idle-store';

test('it updates the checkpoint stream error state', () => {
  setCheckpointStreamError({ activityID: 'activity_1', reason: 'broken-chain-link' });

  const hook = renderHook(() => useIdleStore((state) => state.checkpointStreamError));

  expect(hook.result.current).toStrictEqual({
    activityID: 'activity_1',
    reason: 'broken-chain-link',
  });
});

test('it clears the reward-slot ledger when the stream is rejected', () => {
  useIdleStore.setState({
    checkpointStreamError: null,
    rewardSlotLedger: [{ count: 2, version: 1 }],
  });

  setCheckpointStreamError({ activityID: 'activity_1', reason: 'broken-chain-link' });
  expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([]);

  expect(useIdleStore.getState().checkpointStreamError).toStrictEqual({
    activityID: 'activity_1',
    reason: 'broken-chain-link',
  });
});
