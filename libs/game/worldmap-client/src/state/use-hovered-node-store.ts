import type { WorldMapNode } from '@vers/worldmap-core';
import { create } from 'zustand';

interface HoveredNodeStore {
  node: WorldMapNode | null;
}

export const useHoveredNodeStore = create<HoveredNodeStore>(() => ({
  node: null,
}));
