import type { WorldMapNode } from '@vers/worldmap-core';
import type { WorldGraph } from '../types';
import { useWorldmapStore } from './use-worldmap-store';

/**
 * Replaces the active region: the world graph, the selected node, and the selected object
 * reference all move together so no reader observes a graph and selection from different regions.
 */
export function setWorldRegion(graph: WorldGraph, selectedNode: WorldMapNode | null) {
  useWorldmapStore.setState({
    selectedNode,
    selectedObject3D: null,
    worldGraph: graph,
  });
}
