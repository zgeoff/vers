import { useWorldmapStore } from './use-worldmap-store';

export function toggleDevCamera() {
  useWorldmapStore.setState((state) => ({
    isDevCameraActive: !state.isDevCameraActive,
  }));
}
