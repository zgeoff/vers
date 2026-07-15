import type { SimulationSnapshot } from '@vers/idle-core';
import { useIdleStore } from './use-idle-store';

/**
 * Applies a whole worker simulation snapshot in one `setState`, so a per-frame update triggers a
 * single notification pass instead of one per field. Resets the reward-slot ledger the instant the
 * active activity's id changes, rather than waiting for that activity's first non-zero reward-slot
 * message — a fresh activity can otherwise go checkpoints deep before it emits one.
 */
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
