import { useWorldmapStore } from './use-worldmap-store';

export function useRegionKey() {
  return useWorldmapStore((state) => state.regionKey);
}
