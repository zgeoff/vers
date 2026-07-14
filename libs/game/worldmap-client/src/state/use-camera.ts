import { useWorldmapStore } from './use-worldmap-store';

export function useCamera() {
  return useWorldmapStore((state) => state.camera);
}
