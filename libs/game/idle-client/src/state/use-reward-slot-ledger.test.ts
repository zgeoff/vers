import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useIdleStore } from './use-idle-store';
import { useRewardSlotLedger } from './use-reward-slot-ledger';

test('it provides the reward-slot ledger', () => {
  useIdleStore.setState({ rewardSlotLedger: [{ count: 2, version: 1 }] });

  const hook = renderHook(() => useRewardSlotLedger());

  expect(hook.result.current).toStrictEqual([{ count: 2, version: 1 }]);
});
