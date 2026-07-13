import type { CombatExecutorSnapshot } from '@vers/idle-core';
import { create } from 'zustand';

interface CombatStore {
  combat: CombatExecutorSnapshot | null;
}

export const useCombatStore = create<CombatStore>()(() => ({
  combat: null,
}));
