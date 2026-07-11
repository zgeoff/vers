import { animated, config, useSpring } from '@react-spring/three';
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef } from 'react';
import type { Group, Object3D, PerspectiveCamera as PerspectiveCameraImpl } from 'three';
import { CameraHelper, Euler } from 'three';
import {
  CAMERA_DISTANCE,
  CAMERA_ROTATION_X,
  CAMERA_ROTATION_Y,
  ISOMETRIC_OFFSET_X,
  ISOMETRIC_OFFSET_Z,
} from '../consts';
import { setCamera } from '../state/set-camera';
import { useCamera } from '../state/use-camera';
import { useIsDevCameraActive } from '../state/use-is-dev-camera-active';
import { useSelectedNode } from '../state/use-selected-node';
import { useMakeDefaultCamera } from './use-make-default-camera';

const ISOMETRIC_CAMERA_ROTATION = new Euler(CAMERA_ROTATION_X, CAMERA_ROTATION_Y, 0, 'YXZ');

const AnimatedGroup = animated['group'];

/**
 * this component is a lie. it used to be an orthographic camera configured
 * for an isometric view, but now it's just a perspective camera with the same fixed
 * height and rotation. with out current Aether layout, isometric looks awful.
 */
export function IsometricCamera() {
  const cameraRigRef = useRef<Group | null>(null);
  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);
  const camera = useCamera();
  const isDevCameraActive = useIsDevCameraActive();
  const selectedNode = useSelectedNode();
  const [positionX, positionY, positionZ] = getNodeCameraPosition(selectedNode.object3D);

  const spring = useSpring({
    config: {
      ...config.gentle,
      clamp: true,
      precision: 0.001,
    },
    x: positionX,
    y: positionY,
    z: positionZ,
  });

  const setCameraRef = useCallback((cameraInstance: null | PerspectiveCameraImpl) => {
    cameraRef.current = cameraInstance;

    if (!cameraInstance) {
      return;
    }

    setCamera(cameraInstance);
  }, []);

  const helperCamera = import.meta.env.DEV ? camera : null;

  useMakeDefaultCamera(cameraRef, !isDevCameraActive);
  useCameraHelper(helperCamera);

  // force our isometric camera rotation and height unless we're using our dev camera, and keep
  // its aspect ratio and projection matrix in sync with the canvas
  useFrame((state) => {
    if (!camera || !cameraRigRef.current) {
      return;
    }

    cameraRigRef.current.rotation.copy(ISOMETRIC_CAMERA_ROTATION);

    cameraRigRef.current.position.y = CAMERA_DISTANCE;
    camera.aspect = state.size.width / state.size.height;

    camera.updateProjectionMatrix();
  });

  return (
    <AnimatedGroup position={[spring.x, spring.y, spring.z]} rotation={ISOMETRIC_CAMERA_ROTATION}>
      <perspectiveCamera ref={setCameraRef} />
    </AnimatedGroup>
  );
}

// keeping this for a rainy day
// <orthographicCamera
//   ref={cameraRef}
//   args={[
//     -CAMERA_DISTANCE * aspect,
//     CAMERA_DISTANCE * aspect,
//     CAMERA_DISTANCE,
//     -CAMERA_DISTANCE,
//     1,
//     1000,
//   ]}
// />

/**
 * get the camera position we want to animate to for a given node
 * @param node - the node to get the camera position for
 * @returns the camera position
 */
function getNodeCameraPosition(node: null | Object3D): [number, number, number] {
  if (!node) {
    return [0, CAMERA_DISTANCE, 0];
  }

  return [
    node.position.x + ISOMETRIC_OFFSET_X,
    CAMERA_DISTANCE,
    -(node.position.y - ISOMETRIC_OFFSET_Z),
  ];
}

/**
 * renders a `CameraHelper` frustum visualization for `camera` in dev tooling, keeping it in sync
 * every frame; a null `camera` renders nothing.
 */
function useCameraHelper(camera: null | PerspectiveCameraImpl) {
  const scene = useThree((state) => state.scene);
  const helperRef = useRef<CameraHelper | null>(null);

  useEffect(() => {
    if (!camera) {
      return () => {};
    }

    const helper = new CameraHelper(camera);

    helperRef.current = helper;

    scene.add(helper);

    return () => {
      helperRef.current = null;

      scene.remove(helper);
      helper.dispose();
    };
  }, [camera, scene]);

  useFrame(() => {
    helperRef.current?.update();
  });
}
