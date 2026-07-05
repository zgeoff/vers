import type { PerspectiveCamera } from 'three';
import { useCameraStore } from './use-camera-store';

export function setCamera(camera: null | PerspectiveCamera) {
  useCameraStore.setState({ camera });
}
