import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useIdleStore } from './use-idle-store';
import { useRewardSlotLedger } from './use-reward-slot-ledger';

test('it provides the reward-slot ledger with the activity its entries belong to', () => {
  useIdleStore.setState({
    rewardSlotLedger: [{ count: 2, version: 1 }],
    rewardSlotLedgerActivityID: 'activity_1',
  });

  const hook = renderHook(() => useRewardSlotLedger());

  expect(hook.result.current).toStrictEqual({
    activityID: 'activity_1',
    entries: [{ count: 2, version: 1 }],
  });
});
