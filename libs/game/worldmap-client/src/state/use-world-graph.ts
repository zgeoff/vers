import { useShallow } from 'zustand/react/shallow';
import { useWorldGraphStore } from './use-world-graph-store';

export function useWorldGraph() {
  const graph = useWorldGraphStore(
    useShallow((state) => ({
      edges: state.edges,
      nodes: state.nodes,
    })),
  );

  return graph;
}
