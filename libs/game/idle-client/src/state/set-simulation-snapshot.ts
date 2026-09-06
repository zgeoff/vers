import type { SimulationSnapshot } from '@vers/idle-core';
import type { LiveRun } from '../worker/live-run-schema';
import { useIdleStore } from './use-idle-store';

export function setSimulationSnapshot(snapshot: SimulationSnapshot, liveRun?: LiveRun) {
  useIdleStore.setState((state) => {
    const activity = snapshot.activity ?? null;
    const activityID = activity?.id ?? null;

    return {
      activity,
      avatar: snapshot.avatar ?? null,
      combat: snapshot.combat ?? null,
      failureAction: snapshot.failureAction,
      liveRun: liveRun ?? null,
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
