import type { PerspectiveCamera } from 'three';
import { useCameraStore } from './use-camera-store';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function setCamera(camera: null | PerspectiveCamera) {
  useCameraStore.setState({ camera });
}
