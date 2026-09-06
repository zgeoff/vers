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
      ...(needsRunOutcomeReset(state.runOutcome?.activityID ?? null, activityID)
        ? { runOutcome: null }
        : {}),
    };
  });
}

// the outcome outlives the ended run's own frames and an activity-less snapshot, and clears only
// once a different run goes live
function needsRunOutcomeReset(outcomeActivityID: string | null, nextActivityID: string | null) {
  return (
    outcomeActivityID !== null && nextActivityID !== null && outcomeActivityID !== nextActivityID
  );
}

function needsRewardSlotLedgerReset(
  ledgerActivityID: string | null,
  nextActivityID: string | null,
): boolean {
  return ledgerActivityID !== nextActivityID;
}
