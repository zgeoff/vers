import type { AetherNode } from '@vers/aether-core';
import { create } from 'zustand';

interface HoveredNodeStore {
  node: AetherNode | null;
}

export const useHoveredNodeStore = create<HoveredNodeStore>(() => ({
  node: null,
}));
