import type { SimulationSnapshot } from '@vers/idle-core';
import { useIdleStore } from './use-idle-store';

export function setSimulationSnapshot(snapshot: SimulationSnapshot) {
  useIdleStore.setState((state) => {
    const activity = snapshot.activity ?? null;
    const activityID = activity?.id ?? null;

    return {
      activity,
      avatar: snapshot.avatar ?? null,
      combat: snapshot.combat ?? null,
      failureAction: snapshot.failureAction,
      ...(needsRewardSlotLedgerReset(state.rewardSlotLedgerActivityID, activityID)
        ? { rewardSlotLedger: [], rewardSlotLedgerActivityID: activityID }
        : {}),
    };
  });
}

function needsRewardSlotLedgerReset(
  ledgerActivityID: string | null,
  nextActivityID: string | null,
): boolean {
  return ledgerActivityID !== nextActivityID;
}
