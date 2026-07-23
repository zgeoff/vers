import type { LatticeNode } from '@vers/worldmap-core';
import { useWorldmapStore } from './use-worldmap-store';

export function setHoveredNode(node: LatticeNode | null) {
  useWorldmapStore.setState({ hoveredNode: node });
}
