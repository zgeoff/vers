import { useDevStore } from './use-dev-store';

export function useIsDevCameraActive() {
  const isDevCameraActive = useDevStore((state) => state.isDevCameraActive);

  return isDevCameraActive;
}
