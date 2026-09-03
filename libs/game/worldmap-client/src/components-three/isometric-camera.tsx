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

const POLAR_ANGLE = -CAMERA_ROTATION_X;
const AZIMUTH_ANGLE = CAMERA_ROTATION_Y;
const INITIAL_DISTANCE = ZOOM_MIN_DISTANCE;
const TRUCK_SPEED = 4;
const SMOOTH_TIME = 0.12;
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

const JITTER_MARGIN = JITTER * NODE_POSITION_SCALING_FACTOR;

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
    // boundaryFriction stays 0: camera-controls' friction ease divides by the dot of the drag
    // offset and the clamp delta, a hard flick against the boundary can make that dot vanish, and
    // the NaN poisons the whole camera transform, blanking the canvas with nothing thrown
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

  // controlsVersion is a dependency so a controls instance rebuilt by the effect above reapplies
  // the current selection's target instead of resting on its constructor default
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
