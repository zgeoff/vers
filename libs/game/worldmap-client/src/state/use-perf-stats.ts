import { useWorldmapStore } from './use-worldmap-store';

export function usePerfStats() {
  return useWorldmapStore((state) => state.perfStats);
}
