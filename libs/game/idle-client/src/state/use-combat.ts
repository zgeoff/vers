import { useShallow } from 'zustand/react/shallow';
import { useCombatStore } from './use-combat-store';

export function useCombat() {
  const combat = useCombatStore(useShallow((state) => state.combat));

  return combat;
}
