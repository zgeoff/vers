import { useCameraStore } from './use-camera-store';

export function useCamera() {
  const camera = useCameraStore((state) => state.camera);

  return camera;
}
