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

// to allow for tree shaking, only import the subset of three.js camera-controls depends on
// see https://github.com/yomotsu/camera-controls#important
CameraControlsImpl.install({
  THREE: { Box3, Matrix4, Quaternion, Raycaster, Sphere, Spherical, Vector2, Vector3, Vector4 },
});

export function CameraControls() {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const controlsRef = useRef<CameraControlsImpl | null>(null);

  useEffect(() => {
    const controls = new CameraControlsImpl(camera);

    controlsRef.current = controls;

    controls.connect(domElement);

    return () => {
      controls.disconnect();
      controls.dispose();

      controlsRef.current = null;
    };
  }, [camera, domElement]);

  useFrame((_state, delta) => {
    controlsRef.current?.update(delta);
  });

  return null;
}
