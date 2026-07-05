import type { PerspectiveCamera } from 'three';
import { create } from 'zustand';

interface CameraStore {
  camera: null | PerspectiveCamera;
}

export const useCameraStore = create<CameraStore>(() => ({
  camera: null,
}));
