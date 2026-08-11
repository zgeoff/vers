import { useWorldmapStore } from './use-worldmap-store';

export function useViewport() {
  return useWorldmapStore((state) => state.viewport);
}
