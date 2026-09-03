import type { RevealSource, WorldMapNode } from '@vers/worldmap-core';
import type { WorldGraph } from '../types';
import { useWorldmapStore } from './use-worldmap-store';

export function setWorldRegion(
  regionKey: string,
  userSeed: number,
  graph: WorldGraph,
  selectedNode: WorldMapNode | null,
  selectableNodeIDs: ReadonlySet<string>,
  revealSources: ReadonlyArray<RevealSource>,
) {
  if (useWorldmapStore.getState().regionKey === regionKey) {
    useWorldmapStore.setState({ revealSources, selectableNodeIDs, userSeed, worldGraph: graph });

    return;
  }

  useWorldmapStore.setState({
    regionKey,
    revealSources,
    selectableNodeIDs,
    selectedNode,
    selectedObject3D: null,
    userSeed,
    viewport: null,
    worldGraph: graph,
  });
}
