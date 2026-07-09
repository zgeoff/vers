import type { AetherNode } from '@vers/aether-core';
import type { Object3D } from 'three';
import { useSelectedNodeStore } from './use-selected-node-store';

export function setSelectedNode(node: AetherNode | null, object3D?: null | Object3D) {
  useSelectedNodeStore.setState({ node, object3D: object3D ?? null });
}
