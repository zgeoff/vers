export interface DevSlice {
  isAxesHelperVisible: boolean;
  isDevCameraActive: boolean;
}

export function createDevSlice(): DevSlice {
  return {
    isAxesHelperVisible: false,
    isDevCameraActive: false,
  };
}
