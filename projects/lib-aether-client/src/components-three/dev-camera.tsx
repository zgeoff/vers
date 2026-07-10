import { useThree } from '@react-three/fiber';
import { useRef } from 'react';
import type { PerspectiveCamera as PerspectiveCameraImpl } from 'three';
import { useIsDevCameraActive } from '../state/use-is-dev-camera-active';
import { CameraControls } from './camera-controls';
import { useMakeDefaultCamera } from './use-make-default-camera';

export function DevCamera() {
  const canvasSize = useThree((state) => state.size);
  const isDevCameraActive = useIsDevCameraActive();
  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);

  const aspect = canvasSize.width / canvasSize.height;

  useMakeDefaultCamera(cameraRef, isDevCameraActive);

  if (!isDevCameraActive) {
    return null;
  }

  return (
    <>
      <CameraControls />
      <perspectiveCamera
        ref={cameraRef}
        args={[75, aspect, 0.1, 1000]}
        position={[0, 500, -500]}
        rotation={[-Math.PI / 4, 0, 0]}
      />
    </>
  );
}
