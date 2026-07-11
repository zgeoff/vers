import type { WorldNode } from '@vers/worldmap-core';
import { create } from 'zustand';

interface HoveredNodeStore {
  node: WorldNode | null;
}

export const useHoveredNodeStore = create<HoveredNodeStore>(() => ({
  node: null,
}));
