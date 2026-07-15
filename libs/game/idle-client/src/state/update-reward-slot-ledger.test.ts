import { expect, test } from 'bun:test';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import { updateRewardSlotLedger } from './update-reward-slot-ledger';
import { useIdleStore } from './use-idle-store';

test('it accumulates ledger entries for the current activity', () => {
  useIdleStore.setState({
    checkpointStreamError: null,
    rewardSlotLedger: [],
    rewardSlotLedgerActivityID: 'activity_1',
  });

  updateRewardSlotLedger({ activityID: 'activity_1', count: 2, version: 1 });
  updateRewardSlotLedger({ activityID: 'activity_1', count: 3, version: 2 });

  expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([
    { count: 2, version: 1 },
    { count: 3, version: 2 },
  ]);
});

test('it drops a message naming an activity the ledger was not built for', () => {
  useIdleStore.setState({
    activity: createMockActivitySnapshot({ id: 'activity_1' }),
    checkpointStreamError: null,
    rewardSlotLedger: [{ count: 2, version: 1 }],
    rewardSlotLedgerActivityID: 'activity_1',
  });

  updateRewardSlotLedger({ activityID: 'activity_2', count: 4, version: 1 });
  expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 2, version: 1 }]);
  expect(useIdleStore.getState().rewardSlotLedgerActivityID).toBe('activity_1');
});

test('it installs the first entry when the ledger has no activity and the message matches the simulation', () => {
  useIdleStore.setState({
    activity: createMockActivitySnapshot({ id: 'activity_1' }),
    checkpointStreamError: null,
    rewardSlotLedger: [],
    rewardSlotLedgerActivityID: null,
  });

  updateRewardSlotLedger({ activityID: 'activity_1', count: 2, version: 1 });
  expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 2, version: 1 }]);
  expect(useIdleStore.getState().rewardSlotLedgerActivityID).toBe('activity_1');
});

test('it ignores a message while the stream for that activity is rejected', () => {
  useIdleStore.setState({
    checkpointStreamError: { activityID: 'activity_1', reason: 'broken-chain-link' },
    rewardSlotLedger: [],
    rewardSlotLedgerActivityID: 'activity_1',
  });

  updateRewardSlotLedger({ activityID: 'activity_1', count: 2, version: 1 });
  expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([]);
});
