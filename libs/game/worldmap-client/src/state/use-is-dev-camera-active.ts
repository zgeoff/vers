import { useWorldmapStore } from './use-worldmap-store';

export function useIsDevCameraActive() {
  return useWorldmapStore((state) => state.isDevCameraActive);
}
