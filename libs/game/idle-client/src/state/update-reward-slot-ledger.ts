import { useIdleStore } from './use-idle-store';

interface RewardSlotsRecordedInput {
  readonly activityID: string;
  readonly count: number;
  readonly version: number;
}

/**
 * Appends one checkpoint's recorded reward-slot count to the ledger, resetting it first when
 * `activityID` doesn't match the activity the ledger's current entries were built for — so a
 * stale entry from an activity the ledger has moved past never survives into the next one.
 */
export function updateRewardSlotLedger(input: Readonly<RewardSlotsRecordedInput>) {
  useIdleStore.setState((state) => {
    const entries =
      state.rewardSlotLedgerActivityID === input.activityID ? state.rewardSlotLedger : [];

    return {
      rewardSlotLedger: [...entries, { count: input.count, version: input.version }],
      rewardSlotLedgerActivityID: input.activityID,
    };
  });
}
