import { useIdleStore } from './use-idle-store';

export function useCombatElapsed(): number {
  return useIdleStore((state) => state.combat?.elapsed ?? 0);
}
