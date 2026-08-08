import type { LatticeNode } from '@vers/worldmap-core';
import type { Object3D } from 'three';

export interface InteractionSlice {
  hoveredNode: LatticeNode | null;
  selectedNode: LatticeNode | null;
  selectedObject3D: null | Object3D;
}

export function createInteractionSlice(): InteractionSlice {
  return {
    hoveredNode: null,
    selectedNode: null,
    selectedObject3D: null,
  };
}
