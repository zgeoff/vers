import type { WorldGraph } from '../types';
import { useWorldmapStore } from './use-worldmap-store';

export function setWorldGraph(graph: WorldGraph) {
  useWorldmapStore.setState({ worldGraph: graph });
}
