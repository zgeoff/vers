import { useIdleStore } from './use-idle-store';

interface RewardSlotsRecordedInput {
  readonly activityID: string;
  readonly count: number;
  readonly version: number;
}

/**
 * Appends one checkpoint's recorded reward-slot count to the ledger. A message naming any activity
 * other than the one the ledger's entries belong to is dropped rather than treated as a switch, so
 * a late checkpoint from a previous activity can't wipe and repopulate the current activity's
 * ledger. The activity change itself is owned by the snapshot handler, which resets the ledger and
 * stamps its new activity; this appends into an empty ledger only when the message matches the
 * running simulation. A message for an activity whose stream has been rejected is ignored, so a
 * ledger cleared by that rejection never repopulates from checkpoints still in flight.
 */
export function updateRewardSlotLedger(input: Readonly<RewardSlotsRecordedInput>) {
  useIdleStore.setState((state) => {
    if (state.checkpointStreamError?.activityID === input.activityID) {
      return {};
    }

    const entry = { count: input.count, version: input.version };

    if (state.rewardSlotLedgerActivityID === input.activityID) {
      return { rewardSlotLedger: [...state.rewardSlotLedger, entry] };
    }

    if (state.rewardSlotLedgerActivityID === null && state.activity?.id === input.activityID) {
      return { rewardSlotLedger: [entry], rewardSlotLedgerActivityID: input.activityID };
    }

    return {};
  });
}
