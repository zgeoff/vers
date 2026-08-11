import { expect, test } from 'bun:test';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { act } from 'react';
import { Object3D, Spherical } from 'three';
import invariant from 'tiny-invariant';
import {
  CAMERA_ROTATION_X,
  CAMERA_ROTATION_Y,
  ZOOM_MAX_DISTANCE,
  ZOOM_MIN_DISTANCE,
} from '../consts';
import { setSelectedNode } from '../state/set-selected-node';
import { useWorldmapStore } from '../state/use-worldmap-store';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import { IsometricCamera } from './isometric-camera';

test('it mounts the camera pinned to the isometric angle at the minimum zoom distance', async () => {
  const renderer = await ReactThreeTestRenderer.create(<IsometricCamera />);

  await renderer.advanceFrames(1, 1 / 60);

  const camera = useWorldmapStore.getState().camera;

  invariant(camera, 'the camera mounts synchronously with the component');

  // the controls' target starts at the origin, so the camera's position in spherical terms is its
  // dolly distance plus the two pinned angles: phi the tilt down from overhead, theta the turn
  const spherical = new Spherical().setFromVector3(camera.position);

  expect(spherical.radius).toBeCloseTo(ZOOM_MIN_DISTANCE, 5);
  expect(spherical.phi).toBeCloseTo(-CAMERA_ROTATION_X, 5);
  expect(spherical.theta).toBeCloseTo(CAMERA_ROTATION_Y, 5);
});

test("it glides the camera to center a newly selected node's ground position", async () => {
  const renderer = await ReactThreeTestRenderer.create(<IsometricCamera />);

  await renderer.advanceFrames(1, 1 / 60);

  const camera = useWorldmapStore.getState().camera;

  invariant(camera, 'the camera mounts synchronously with the component');

  const restPosition = camera.position.clone();
  const node = createMockWorldMapNode();

  const object3D = new Object3D();

  object3D.position.set(40, 15, 0);

  act(() => {
    setSelectedNode(node, object3D);
  });

  await renderer.advanceFrames(300, 1 / 60);

  expect(camera.position.x).toBeCloseTo(restPosition.x + 40, 1);
  expect(camera.position.y).toBeCloseTo(restPosition.y, 1);
  expect(camera.position.z).toBeCloseTo(restPosition.z - 15, 1);
});

test('it re-centers the camera on the current selection once the scene remounts', async () => {
  const renderer = await ReactThreeTestRenderer.create(<IsometricCamera />);

  const node = createMockWorldMapNode();

  const object3D = new Object3D();

  object3D.position.set(40, 15, 0);

  act(() => {
    setSelectedNode(node, object3D);
  });

  await renderer.advanceFrames(300, 1 / 60);

  const settledCamera = useWorldmapStore.getState().camera;

  invariant(settledCamera, 'the camera mounts synchronously with the component');

  const targetedPosition = settledCamera.position.clone();

  await renderer.unmount();

  const remounted = await ReactThreeTestRenderer.create(<IsometricCamera />);

  await remounted.advanceFrames(300, 1 / 60);

  const remountedCamera = useWorldmapStore.getState().camera;

  invariant(remountedCamera, 'the camera mounts synchronously with the component');

  expect(remountedCamera.position.x).toBeCloseTo(targetedPosition.x, 1);
  expect(remountedCamera.position.y).toBeCloseTo(targetedPosition.y, 1);
  expect(remountedCamera.position.z).toBeCloseTo(targetedPosition.z, 1);
});

test('it settles at the maximum zoom distance when a wheel dolly pushes far past it', async () => {
  const canvasRef: { current: HTMLCanvasElement | null } = { current: null };

  const renderer = await ReactThreeTestRenderer.create(<IsometricCamera />, {
    beforeReturn: (canvas) => {
      canvasRef.current = canvas;
    },
  });

  await renderer.advanceFrames(1, 1 / 60);

  const domElement = canvasRef.current;

  invariant(domElement, 'the test renderer hands its canvas to beforeReturn before rendering');

  // one enormous wheel step dollies to several times the maximum distance in a single gesture;
  // positive deltaY is zoom-out under the wheel-to-dolly binding
  domElement.dispatchEvent(new WheelEvent('wheel', { cancelable: true, deltaY: 1_000_000 }));

  await renderer.advanceFrames(600, 1 / 60);

  const camera = useWorldmapStore.getState().camera;

  invariant(camera, 'the camera mounts synchronously with the component');

  // the dolly moves the camera along its view axis, so the target stays at the origin and the
  // settled position's spherical radius is the effective dolly distance
  const spherical = new Spherical().setFromVector3(camera.position);

  expect(spherical.radius).toBeCloseTo(ZOOM_MAX_DISTANCE, 1);
  expect(spherical.phi).toBeCloseTo(-CAMERA_ROTATION_X, 5);
  expect(spherical.theta).toBeCloseTo(CAMERA_ROTATION_Y, 5);
});
