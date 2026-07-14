import type { WorldGraph } from '@vers/worldmap-core';
import { useWorldmapStore } from './use-worldmap-store';

export function setWorldGraph(graph: WorldGraph) {
  useWorldmapStore.setState({ worldGraph: graph });
}
