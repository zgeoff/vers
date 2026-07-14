import { useWorldmapStore } from './use-worldmap-store';

export function useIsAxesHelperVisible() {
  return useWorldmapStore((state) => state.isAxesHelperVisible);
}
