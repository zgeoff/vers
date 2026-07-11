import type { WorldNode } from '@vers/worldmap-core';
import { useHoveredNodeStore } from './use-hovered-node-store';

export function setHoveredNode(node: WorldNode | null) {
  useHoveredNodeStore.setState({ node });
}
