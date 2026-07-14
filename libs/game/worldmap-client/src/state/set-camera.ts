import type { PerspectiveCamera } from 'three';
import { useWorldmapStore } from './use-worldmap-store';

export function setCamera(camera: null | PerspectiveCamera) {
  useWorldmapStore.setState({ camera });
}
