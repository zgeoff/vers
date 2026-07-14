import { useWorldmapStore } from './use-worldmap-store';

export function useWorldGraph() {
  return useWorldmapStore((state) => state.worldGraph);
}
