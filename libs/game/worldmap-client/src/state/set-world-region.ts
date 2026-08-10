import type { WorldMapNode } from '@vers/worldmap-core';
import type { WorldGraph } from '../types';
import { useWorldmapStore } from './use-worldmap-store';

/**
 * Replaces the active region: the region key, the world graph, the selected node, and the selected
 * object reference all move together so no reader observes a graph and selection from different
 * regions. Callers key the region by whose region it is (the avatar id), not by the seed that
 * generated it — two avatars can share a seed, and a switch between them must still reset the
 * selection. A write for the key the store already holds is skipped, so a remounting caller
 * re-submitting the current region doesn't discard the player's selection.
 */
export function setWorldRegion(
  regionKey: string,
  graph: WorldGraph,
  selectedNode: WorldMapNode | null,
) {
  if (useWorldmapStore.getState().regionKey === regionKey) {
    return;
  }

  useWorldmapStore.setState({
    regionKey,
    selectedNode,
    selectedObject3D: null,
    worldGraph: graph,
  });
}
