import { useFrame, useThree } from '@react-three/fiber';
import { WORLD_COORD_MAX, WORLD_COORD_MIN, toHexPosition } from '@vers/worldmap-core';
import CameraControlsImpl from 'camera-controls';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PerspectiveCamera as PerspectiveCameraImpl } from 'three';
import {
  Box3,
  CameraHelper,
  Matrix4,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
} from 'three';
import {
  CAMERA_ROTATION_X,
  CAMERA_ROTATION_Y,
  NODE_POSITION_SCALING_FACTOR,
  ZOOM_MAX_DISTANCE,
  ZOOM_MIN_DISTANCE,
} from '../consts';
import { setCamera } from '../state/set-camera';
import { useCamera } from '../state/use-camera';
import { useIsDevCameraActive } from '../state/use-is-dev-camera-active';
import { useSelectedNode } from '../state/use-selected-node';
import { useMakeDefaultCamera } from './use-make-default-camera';

// to allow for tree shaking, only import the subset of three.js camera-controls depends on
// see https://github.com/yomotsu/camera-controls#important
CameraControlsImpl.install({
  THREE: { Box3, Matrix4, Quaternion, Raycaster, Sphere, Spherical, Vector2, Vector3, Vector4 },
});

/**
 * Fixed spherical offset reproducing the rig's original isometric viewing angle: `POLAR_ANGLE` is
 * the tilt down from directly overhead, `AZIMUTH_ANGLE` the turn around the vertical axis.
 */
const POLAR_ANGLE = -CAMERA_ROTATION_X;
const AZIMUTH_ANGLE = CAMERA_ROTATION_Y;

/**
 * Starting dolly distance: the closest allowed, so a fresh session opens focused before the player
 * zooms out to explore.
 */
const INITIAL_DISTANCE = ZOOM_MIN_DISTANCE;

/**
 * Ease-back strength at the world boundary: strong enough that a rest position never reads as past
 * the edge, soft enough that reaching it doesn't feel like a hard stop.
 */
const BOUNDARY_FRICTION = 0.8;

const WORLD_CORNER_CELLS: ReadonlyArray<readonly [number, number]> = [
  [WORLD_COORD_MIN, WORLD_COORD_MIN],
  [WORLD_COORD_MIN, WORLD_COORD_MAX],
  [WORLD_COORD_MAX, WORLD_COORD_MIN],
  [WORLD_COORD_MAX, WORLD_COORD_MAX],
];

const worldCornerXs = WORLD_CORNER_CELLS.map(
  ([cx, cy]) => toHexPosition(cx, cy)[0] * NODE_POSITION_SCALING_FACTOR,
);

const worldCornerZs = WORLD_CORNER_CELLS.map(
  ([cx, cy]) => -toHexPosition(cx, cy)[1] * NODE_POSITION_SCALING_FACTOR,
);

/**
 * The box the camera's pan target eases back from at the world's rim: the scene-unit footprint of
 * every cell coordinate the lattice can encode, flattened onto the ground plane. A zero-height box
 * also draws the target back toward the ground whenever a screen-space drag on the tilted camera
 * would otherwise push it off-plane, which keeps the frustum's ground-plane footprint (and so the
 * viewport it drives) tied to the visible zoom range instead of drifting with altitude.
 */
const WORLD_BOUNDARY = new Box3(
  new Vector3(Math.min(...worldCornerXs), 0, Math.min(...worldCornerZs)),
  new Vector3(Math.max(...worldCornerXs), 0, Math.max(...worldCornerZs)),
);

/**
 * A perspective camera fixed at an isometric tilt and turn; a true orthographic isometric
 * projection reads poorly against the current world layout. `camera-controls` drives pan (truck)
 * and zoom (dolly) input, with rotation pinned to the fixed angle above and panning eased back at
 * the world boundary. Selecting a node glides the camera to center it.
 */
export function IsometricCamera() {
  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const domElement = useThree((state) => state.gl.domElement);
  const camera = useCamera();
  const isDevCameraActive = useIsDevCameraActive();
  const selectedNode = useSelectedNode();
  const [controlsVersion, setControlsVersion] = useState(0);

  const setCameraRef = useCallback((cameraInstance: null | PerspectiveCameraImpl) => {
    cameraRef.current = cameraInstance;

    setCamera(cameraInstance);
  }, []);

  const helperCamera = import.meta.env.DEV ? camera : null;

  useMakeDefaultCamera(cameraRef, !isDevCameraActive);
  useCameraHelper(helperCamera);

  useEffect(() => {
    if (!camera) {
      return () => {};
    }

    const controls = new CameraControlsImpl(camera);

    controls.connect(domElement);

    controls.minDistance = ZOOM_MIN_DISTANCE;
    controls.maxDistance = ZOOM_MAX_DISTANCE;
    controls.minPolarAngle = POLAR_ANGLE;
    controls.maxPolarAngle = POLAR_ANGLE;
    controls.minAzimuthAngle = AZIMUTH_ANGLE;
    controls.maxAzimuthAngle = AZIMUTH_ANGLE;
    controls.boundaryFriction = BOUNDARY_FRICTION;
    controls.mouseButtons.left = CameraControlsImpl.ACTION.TRUCK;
    controls.mouseButtons.right = CameraControlsImpl.ACTION.TRUCK;
    controls.mouseButtons.middle = CameraControlsImpl.ACTION.NONE;
    controls.mouseButtons.wheel = CameraControlsImpl.ACTION.DOLLY;
    controls.touches.one = CameraControlsImpl.ACTION.TOUCH_TRUCK;
    controls.touches.two = CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK;
    controls.touches.three = CameraControlsImpl.ACTION.NONE;

    controls.setBoundary(WORLD_BOUNDARY);
    void controls.rotateTo(AZIMUTH_ANGLE, POLAR_ANGLE, false);
    void controls.dollyTo(INITIAL_DISTANCE, false);
    controlsRef.current = controls;

    setControlsVersion((version) => version + 1);

    return () => {
      controls.disconnect();
      controls.dispose();

      controlsRef.current = null;
    };
  }, [camera, domElement]);

  // depends on controlsVersion, not just selectedNode, so a controls instance rebuilt by the effect
  // above (a remount after the scene swaps away and back) reapplies the current selection's target
  // instead of leaving the rebuilt controls centred on their constructor default; the very first
  // selection (the avatar's origin, on region load) glides too, since its jittered position sits
  // imperceptibly close to the controls' own starting target
  useEffect(() => {
    const controls = controlsRef.current;
    const object3D = selectedNode.object3D;

    if (!controls || !object3D) {
      return;
    }

    void controls.moveTo(object3D.position.x, 0, -object3D.position.y, true);
  }, [selectedNode, controlsVersion]);

  useFrame((state, delta) => {
    if (!camera) {
      return;
    }

    camera.aspect = state.size.width / state.size.height;

    camera.updateProjectionMatrix();

    const controls = controlsRef.current;

    if (!controls) {
      return;
    }

    controls.enabled = !isDevCameraActive;

    controls.update(delta);
  });

  return <perspectiveCamera ref={setCameraRef} />;
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
