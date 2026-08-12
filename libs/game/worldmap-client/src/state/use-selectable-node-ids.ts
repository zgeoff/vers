import { useWorldmapStore } from './use-worldmap-store';

export function useSelectableNodeIDs() {
  return useWorldmapStore((state) => state.selectableNodeIDs);
}
