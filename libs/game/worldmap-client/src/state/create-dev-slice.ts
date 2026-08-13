export interface DevSlice {
  isAxesHelperVisible: boolean;
  isDevCameraActive: boolean;
  isFogOfWarVisible: boolean;
}

export function createDevSlice(): DevSlice {
  return {
    isAxesHelperVisible: false,
    isDevCameraActive: false,
    isFogOfWarVisible: true,
  };
}
