import type { WorldMapNode } from '@vers/worldmap-core';
import { useWorldmapStore } from './use-worldmap-store';

export function setHoveredNode(node: WorldMapNode | null) {
  useWorldmapStore.setState({ hoveredNode: node });
}
