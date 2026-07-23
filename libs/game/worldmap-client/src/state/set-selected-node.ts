import type { LatticeNode } from '@vers/worldmap-core';
import type { Object3D } from 'three';
import { useWorldmapStore } from './use-worldmap-store';

export function setSelectedNode(node: LatticeNode | null, object3D?: null | Object3D) {
  useWorldmapStore.setState({ selectedNode: node, selectedObject3D: object3D ?? null });
}
