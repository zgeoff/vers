import { create } from 'zustand';

interface DevStore {
  isAxesHelperVisible: boolean;
  isDevCameraActive: boolean;
}

export const useDevStore = create<DevStore>(() => ({
  isAxesHelperVisible: false,
  isDevCameraActive: false,
}));
