import type { WorldMapNode } from '@vers/worldmap-core';
import type { WorldGraph } from '../types';
import { useWorldmapStore } from './use-worldmap-store';

/**
 * Replaces the active region on a region-key change: the region key, the world graph, the selected
 * node, and the selected object reference all move together so no reader observes a graph and
 * selection from different regions. Callers key the region by whose region it is (the avatar id),
 * not by the seed that generated it — two avatars can share a seed, and a switch between them must
 * still reset the selection. A call for the key the store already holds instead just refreshes the
 * world graph, leaving the selection alone — the shape a caller re-deriving the graph from a moved
 * viewport takes for the same avatar, distinct from an avatar switch.
 */
export function setWorldRegion(
  regionKey: string,
  graph: WorldGraph,
  selectedNode: WorldMapNode | null,
) {
  if (useWorldmapStore.getState().regionKey === regionKey) {
    useWorldmapStore.setState({ worldGraph: graph });

    return;
  }

  useWorldmapStore.setState({
    regionKey,
    selectedNode,
    selectedObject3D: null,
    worldGraph: graph,
  });
}
