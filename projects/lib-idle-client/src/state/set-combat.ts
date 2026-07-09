import type { CombatExecutorAppState } from '@vers/idle-core';
import { useCombatStore } from './use-combat-store';

export function setCombat(combat?: CombatExecutorAppState) {
  useCombatStore.setState(() => ({ combat: combat ?? null }));
}
