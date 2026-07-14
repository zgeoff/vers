import { useWorldmapStore } from './use-worldmap-store';

export function useHoveredNode() {
  return useWorldmapStore((state) => state.hoveredNode);
}
