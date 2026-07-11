import { useShallow } from 'zustand/react/shallow';
import { useAetherGraphStore } from './use-aether-graph-store';

export function useAetherGraph() {
  const graph = useAetherGraphStore(
    useShallow((state) => ({
      edges: state.edges,
      nodes: state.nodes,
    })),
  );

  return graph;
}
