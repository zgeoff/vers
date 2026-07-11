import type { AetherGraph } from '@vers/aether-core';
import { create } from 'zustand';

export const useAetherGraphStore = create<AetherGraph>(() => ({
  edges: {},
  nodes: {},
}));
