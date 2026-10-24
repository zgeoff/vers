import type { RevealSource, WorldMapNode } from '@vers/worldmap-core';
import type { WorldGraph } from '../types';
import { useWorldmapStore } from './use-worldmap-store';

interface SetWorldRegionOptions {
  readonly regionKey: string;
  readonly userSeed: number;
  readonly worldGraph: WorldGraph;
  readonly selectedNode: WorldMapNode | null;
  readonly selectableNodeIDs: ReadonlySet<string>;
  readonly revealSources: ReadonlyArray<RevealSource>;
}

export function setWorldRegion(options: SetWorldRegionOptions) {
  if (useWorldmapStore.getState().regionKey === options.regionKey) {
    useWorldmapStore.setState({
      revealSources: options.revealSources,
      selectableNodeIDs: options.selectableNodeIDs,
      userSeed: options.userSeed,
      worldGraph: options.worldGraph,
    });

    return;
  }

  useWorldmapStore.setState({
    regionKey: options.regionKey,
    revealSources: options.revealSources,
    selectableNodeIDs: options.selectableNodeIDs,
    selectedNode: options.selectedNode,
    selectedObject3D: null,
    userSeed: options.userSeed,
    viewport: null,
    worldGraph: options.worldGraph,
  });
}
