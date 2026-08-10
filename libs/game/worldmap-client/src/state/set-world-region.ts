import type { WorldMapNode } from '@vers/worldmap-core';
import type { WorldGraph } from '../types';
import { useWorldmapStore } from './use-worldmap-store';

/**
 * Replaces the active region: the seed, the world graph, the selected node, and the selected
 * object reference all move together so no reader observes a graph and selection from different
 * regions. A write for the seed the store already holds is skipped, so a remounting caller
 * re-submitting the current region doesn't discard the player's selection.
 */
export function setWorldRegion(seed: number, graph: WorldGraph, selectedNode: WorldMapNode | null) {
  if (useWorldmapStore.getState().worldSeed === seed) {
    return;
  }

  useWorldmapStore.setState({
    selectedNode,
    selectedObject3D: null,
    worldGraph: graph,
    worldSeed: seed,
  });
}
