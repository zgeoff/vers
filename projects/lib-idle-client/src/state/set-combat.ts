import type { CombatExecutorAppState } from '@vers/idle-core';
import { useCombatStore } from './use-combat-store';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function setCombat(combat?: CombatExecutorAppState) {
  useCombatStore.setState(() => ({ combat: combat ?? null }));
}
