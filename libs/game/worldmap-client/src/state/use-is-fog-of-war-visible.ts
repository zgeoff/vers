import { useWorldmapStore } from './use-worldmap-store';

export function useIsFogOfWarVisible() {
  return useWorldmapStore((state) => state.isFogOfWarVisible);
}
