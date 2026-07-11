import type { WorldGraph } from '@vers/worldmap-core';
import { useWorldGraphStore } from './use-world-graph-store';

export function setWorldGraph(graph: WorldGraph) {
  useWorldGraphStore.setState(graph);
}
