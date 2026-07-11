import type { AetherGraph } from '@vers/aether-core';
import { useAetherGraphStore } from './use-aether-graph-store';

export function setAetherGraph(graph: AetherGraph) {
  useAetherGraphStore.setState(graph);
}
