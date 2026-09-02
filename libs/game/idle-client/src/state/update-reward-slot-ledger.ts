import { useIdleStore } from './use-idle-store';

interface RewardSlotsRecordedInput {
  readonly activityID: string;
  readonly count: number;
  readonly version: number;
}

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
