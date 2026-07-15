import { useIdleStore } from './use-idle-store';

export function useRewardSlotLedger() {
  return useIdleStore((state) => state.rewardSlotLedger);
}
