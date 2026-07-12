import type { WorldMapNode } from '@vers/worldmap-core';
import { useHoveredNodeStore } from './use-hovered-node-store';

export function setHoveredNode(node: WorldMapNode | null) {
  useHoveredNodeStore.setState({ node });
}
