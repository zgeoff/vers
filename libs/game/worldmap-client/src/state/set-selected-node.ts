import type { WorldNode } from '@vers/worldmap-core';
import type { Object3D } from 'three';
import { useSelectedNodeStore } from './use-selected-node-store';

export function setSelectedNode(node: WorldNode | null, object3D?: null | Object3D) {
  useSelectedNodeStore.setState({ node, object3D: object3D ?? null });
}
