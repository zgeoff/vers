import type { PerspectiveCamera } from 'three';

export interface CameraSlice {
  camera: null | PerspectiveCamera;
}

export function createCameraSlice(): CameraSlice {
  return {
    camera: null,
  };
}
