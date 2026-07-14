import type { WorldMapNode } from '@vers/worldmap-core';
import type { Object3D } from 'three';

export interface InteractionSlice {
  hoveredNode: WorldMapNode | null;
  selectedNode: WorldMapNode | null;
  selectedObject3D: null | Object3D;
}

export function createInteractionSlice(): InteractionSlice {
  return {
    hoveredNode: null,
    selectedNode: null,
    selectedObject3D: null,
  };
}
