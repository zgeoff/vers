import type { WorldGraph } from '@vers/worldmap-core';
import { create } from 'zustand';

export const useWorldGraphStore = create<WorldGraph>(() => ({
  edges: {},
  nodes: {},
}));
