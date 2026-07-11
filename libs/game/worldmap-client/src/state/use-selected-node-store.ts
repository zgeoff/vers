import type { WorldNode } from '@vers/worldmap-core';
import type { Object3D } from 'three';
import { create } from 'zustand';

interface SelectedNodeStore {
  node: WorldNode | null;
  object3D: null | Object3D;
}

export const useSelectedNodeStore = create<SelectedNodeStore>(() => ({
  node: null,
  object3D: null,
}));
