import { useDevStore } from './use-dev-store';

export function toggleDevCamera() {
  useDevStore.setState((state) => ({
    isDevCameraActive: !state.isDevCameraActive,
  }));
}
