import { expect, test } from 'bun:test';
import { updateRewardSlotLedger } from './update-reward-slot-ledger';
import { useIdleStore } from './use-idle-store';

test('it accumulates ledger entries for the current activity', () => {
  useIdleStore.setState({ rewardSlotLedger: [], rewardSlotLedgerActivityID: null });

  updateRewardSlotLedger({ activityID: 'activity_1', count: 2, version: 1 });
  updateRewardSlotLedger({ activityID: 'activity_1', count: 3, version: 2 });

  expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([
    { count: 2, version: 1 },
    { count: 3, version: 2 },
  ]);
});

test('it resets the ledger when a message names an activity the ledger was not built for', () => {
  useIdleStore.setState({
    rewardSlotLedger: [{ count: 2, version: 1 }],
    rewardSlotLedgerActivityID: 'activity_1',
  });

  updateRewardSlotLedger({ activityID: 'activity_2', count: 4, version: 1 });
  expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 4, version: 1 }]);
});
