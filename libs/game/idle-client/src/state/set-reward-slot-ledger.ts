import type { RewardSlotLedgerSnapshot } from '../types';
import { useIdleStore } from './use-idle-store';

/**
 * Replaces the reward-slot ledger wholesale with the activity and entries carried by an initial
 * state, so a tab connecting mid-run adopts the worker's current view in one update.
 */
export function setRewardSlotLedger(ledger: RewardSlotLedgerSnapshot) {
  useIdleStore.setState({
    rewardSlotLedger: ledger.entries,
    rewardSlotLedgerActivityID: ledger.activityID,
  });
}
