import { useCombatStore } from './use-combat-store';

export function useCombatElapsed(): number {
  return useCombatStore((state) => state.combat?.elapsed ?? 0);
}
