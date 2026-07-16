import { expect, test } from 'bun:test';
import { createSyncSlice } from './create-sync-slice';

test('it builds the empty sync state', () => {
  expect(createSyncSlice()).toStrictEqual({
    checkpointFlushStall: null,
    checkpointStreamError: null,
    connectionOnline: null,
    offlineCapStatus: null,
    resyncStatus: null,
    rewardSlotLedger: [],
    rewardSlotLedgerActivityID: null,
  });
});
