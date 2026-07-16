import { useShallow } from 'zustand/react/shallow';
import type { RewardSlotLedgerSnapshot } from '../types';
import { useIdleStore } from './use-idle-store';

export function useRewardSlotLedger(): RewardSlotLedgerSnapshot {
  return useIdleStore(
    useShallow((state) => ({
      activityID: state.rewardSlotLedgerActivityID,
      entries: state.rewardSlotLedger,
    })),
  );
}
