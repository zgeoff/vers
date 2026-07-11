import type { CombatExecutorAppState } from '@vers/idle-core';
import { create } from 'zustand';

interface CombatStore {
  combat: CombatExecutorAppState | null;
}

export const useCombatStore = create<CombatStore>()(() => ({
  combat: null,
}));
