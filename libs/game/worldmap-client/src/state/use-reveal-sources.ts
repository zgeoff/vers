import { useWorldmapStore } from './use-worldmap-store';

export function useRevealSources() {
  return useWorldmapStore((state) => state.revealSources);
}
