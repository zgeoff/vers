import type { RewardSlotLedgerSnapshot } from '../types';
import { useIdleStore } from './use-idle-store';

export function setRewardSlotLedger(ledger: RewardSlotLedgerSnapshot) {
  useIdleStore.setState({
    rewardSlotLedger: ledger.entries,
    rewardSlotLedgerActivityID: ledger.activityID,
  });
}
