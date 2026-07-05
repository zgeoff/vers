import type { AetherGraph } from '@vers/aether-core';
import { useAetherGraphStore } from './use-aether-graph-store';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function setAetherGraph(graph: AetherGraph) {
  useAetherGraphStore.setState(graph);
}
