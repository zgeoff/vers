import { useFrame, useThree } from '@react-three/fiber';
import { JITTER, WORLD_COORD_MAX, WORLD_COORD_MIN, toHexPosition } from '@vers/worldmap-core';
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
 * Ground covered per pixel of drag, tuned by feel in playtesting against zero boundary friction —
 * the library default reads sluggish against a map this large.
 */
const TRUCK_SPEED = 4;

/**
 * Seconds of easing after input stops. Playtest-tunable on feel: lower reads planted, higher
 * reads floaty — with the boundary clamp absorbing no drag motion, glide is tamed here alone.
 */
const SMOOTH_TIME = 0.12;

/**
 * Seconds of easing while a drag is live. Playtest-tunable on feel alongside the release easing.
 */
const DRAGGING_SMOOTH_TIME = 0.08;

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
 * Scene-unit margin folded into every side of the world boundary: node placement jitters each cell
 * center by up to the per-axis jitter bound, so without the pad a rim node jittered outward would
 * sit past the boundary and the ease-back would fight the camera trying to center it.
 */
const JITTER_MARGIN = JITTER * NODE_POSITION_SCALING_FACTOR;

/**
 * The box the camera's pan target eases back from at the world's rim: the scene-unit footprint of
 * every cell coordinate the lattice can encode, padded by the jitter margin so every jittered node
 * position stays reachable, flattened onto the ground plane. A zero-height box also draws the
 * target back toward the ground whenever a screen-space drag on the tilted camera would otherwise
 * push it off-plane, which keeps the frustum's ground-plane footprint (and so the viewport it
 * drives) tied to the visible zoom range instead of drifting with altitude.
 */
const WORLD_BOUNDARY = new Box3(
  new Vector3(
    Math.min(...worldCornerXs) - JITTER_MARGIN,
    0,
    Math.min(...worldCornerZs) - JITTER_MARGIN,
  ),
  new Vector3(
    Math.max(...worldCornerXs) + JITTER_MARGIN,
    0,
    Math.max(...worldCornerZs) + JITTER_MARGIN,
  ),
);

const targetScratch = new Vector3();

/**
 * A perspective camera fixed at an isometric tilt and turn; a true orthographic isometric
 * projection reads poorly against the current world layout. `camera-controls` drives pan (truck)
 * and zoom (dolly) input, with rotation pinned to the fixed angle above and panning clamped at
 * the world boundary. Selecting a node glides the camera to center it.
 */
export function IsometricCamera() {
  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const lastGoodPoseRef = useRef<null | { position: Vector3; target: Vector3 }>(null);
  const domElement = useThree((state) => state.gl.domElement);
  const camera = useCamera();
  const isDevCameraActive = useIsDevCameraActive();
  const selectedNode = useSelectedNode();
  const [controlsVersion, setControlsVersion] = useState(0);
  const [controlsGeneration, setControlsGeneration] = useState(0);

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
    // boundaryFriction stays 0: the zero-height boundary clamps the target on every drag, and the
    // library's friction ease divides by the dot of the drag offset and the clamp delta — a hard
    // flick can make that dot vanish while the delta doesn't, and the division poisons the whole
    // camera transform with NaN, blanking the canvas with nothing thrown
    controls.truckSpeed = TRUCK_SPEED;
    controls.smoothTime = SMOOTH_TIME;
    controls.draggingSmoothTime = DRAGGING_SMOOTH_TIME;
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
    // controlsGeneration re-runs this effect after a non-finite-pose recovery: the restored camera
    // is finite again, but the discarded controls instance may hold poisoned damping velocities
  }, [camera, domElement, controlsGeneration]);

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

    // a non-finite transform draws nothing and throws nothing — without this restore the canvas
    // would blank permanently and silently, so every healthy frame banks a pose to fall back to
    controls.getTarget(targetScratch);

    if (isFinitePose(camera) && isFiniteVector(targetScratch)) {
      const lastGoodPose = (lastGoodPoseRef.current ??= {
        position: new Vector3(),
        target: new Vector3(),
      });

      lastGoodPose.position.copy(camera.position);
      lastGoodPose.target.copy(targetScratch);
    } else if (lastGoodPoseRef.current) {
      const lastGoodPose = lastGoodPoseRef.current;

      console.error('[isometric-camera] non-finite camera transform; restoring last good pose');

      // the restore rights the camera itself, and the rebuild replaces the controls instance,
      // whose internal damping velocities the same corruption may have poisoned
      void controls.setLookAt(
        lastGoodPose.position.x,
        lastGoodPose.position.y,
        lastGoodPose.position.z,
        lastGoodPose.target.x,
        lastGoodPose.target.y,
        lastGoodPose.target.z,
        false,
      );

      setControlsGeneration((generation) => generation + 1);
    }
  });

  return <perspectiveCamera ref={setCameraRef} />;
}

function isFinitePose(camera: PerspectiveCameraImpl): boolean {
  return (
    isFiniteVector(camera.position) &&
    Number.isFinite(camera.quaternion.x) &&
    Number.isFinite(camera.quaternion.y) &&
    Number.isFinite(camera.quaternion.z) &&
    Number.isFinite(camera.quaternion.w)
  );
}

function isFiniteVector(vector: Readonly<Vector3>): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
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
