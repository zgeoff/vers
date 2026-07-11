import type { AetherNode } from '@vers/aether-core';
import { useHoveredNodeStore } from './use-hovered-node-store';

export function setHoveredNode(node: AetherNode | null) {
  useHoveredNodeStore.setState({ node });
}
