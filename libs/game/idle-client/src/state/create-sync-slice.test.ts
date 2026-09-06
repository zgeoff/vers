import { expect, test } from 'bun:test';
import { createSyncSlice } from './create-sync-slice';

test('it builds the empty sync state', () => {
  expect(createSyncSlice()).toStrictEqual({
    checkpointStreamError: null,
    lastCompletedActivityID: null,
    lastIngestedActivityID: null,
    offlineCapStatus: null,
    resyncStatus: null,
    rewardSlotLedger: [],
    rewardSlotLedgerActivityID: null,
    runOutcome: null,
    writerDisplacedActivityID: null,
  });
});
