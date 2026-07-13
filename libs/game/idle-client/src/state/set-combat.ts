import type { CombatExecutorSnapshot } from '@vers/idle-core';
import { useCombatStore } from './use-combat-store';

export function setCombat(combat?: CombatExecutorSnapshot) {
  useCombatStore.setState(() => ({ combat: combat ?? null }));
}
