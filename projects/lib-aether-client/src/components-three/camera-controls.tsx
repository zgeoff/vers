import { useFrame, useThree } from '@react-three/fiber';
import CameraControlsImpl from 'camera-controls';
import { useEffect, useRef } from 'react';
import {
  Box3,
  Matrix4,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
} from 'three';

const MIN_ZOOM = 10;
const MAX_ZOOM = 30;

// to allow for tree shaking, only import the subset of three.js camera-controls depends on
// see https://github.com/yomotsu/camera-controls#important
CameraControlsImpl.install({
  THREE: { Box3, Matrix4, Quaternion, Raycaster, Sphere, Spherical, Vector2, Vector3, Vector4 },
});

export function CameraControls() {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const controlsRef = useRef<CameraControlsImpl | null>(null);

  controlsRef.current ??= new CameraControlsImpl(camera);

  const controls = controlsRef.current;

  controls.camera = camera;
  controls.minZoom = MIN_ZOOM;
  controls.maxZoom = MAX_ZOOM;

  useEffect(() => {
    controls.connect(domElement);

    return () => {
      controls.disconnect();
      controls.dispose();
    };
  }, [controls, domElement]);

  useFrame((_state, delta) => {
    controls.update(delta);
  });

  return null;
}
