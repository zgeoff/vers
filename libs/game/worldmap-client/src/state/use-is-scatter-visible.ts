import { useWorldmapStore } from './use-worldmap-store';

export function useIsScatterVisible() {
  return useWorldmapStore((state) => state.isScatterVisible);
}
