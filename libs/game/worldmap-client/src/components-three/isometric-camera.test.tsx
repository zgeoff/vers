import { expect, test } from 'bun:test';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import CameraControlsImpl from 'camera-controls';
import { act } from 'react';
import { Object3D, PerspectiveCamera } from 'three';
import invariant from 'tiny-invariant';
import { CAMERA_ROTATION_X, CAMERA_ROTATION_Y, ZOOM_MIN_DISTANCE } from '../consts';
import { setSelectedNode } from '../state/set-selected-node';
import { useWorldmapStore } from '../state/use-worldmap-store';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import { IsometricCamera } from './isometric-camera';

const POLAR_ANGLE = -CAMERA_ROTATION_X;
const AZIMUTH_ANGLE = CAMERA_ROTATION_Y;

/**
 * The camera position an isolated `camera-controls` instance settles at when pinned to the rig's
 * fixed isometric angle and dollied to `ZOOM_MIN_DISTANCE`, computed through the same real library
 * `IsometricCamera` drives rather than hand-derived trigonometry.
 */
function buildRestPosition() {
  const camera = new PerspectiveCamera();
  const controls = new CameraControlsImpl(camera);

  void controls.rotateTo(AZIMUTH_ANGLE, POLAR_ANGLE, false);
  void controls.dollyTo(ZOOM_MIN_DISTANCE, false);
  controls.update(1 / 60);

  return camera.position.clone();
}

test('it mounts the camera pinned to the isometric angle at the minimum zoom distance', async () => {
  const renderer = await ReactThreeTestRenderer.create(<IsometricCamera />);

  await renderer.advanceFrames(1, 1 / 60);

  const camera = useWorldmapStore.getState().camera;

  invariant(camera, 'the camera mounts synchronously with the component');

  const expected = buildRestPosition();

  expect(camera.position.x).toBeCloseTo(expected.x, 5);
  expect(camera.position.y).toBeCloseTo(expected.y, 5);
  expect(camera.position.z).toBeCloseTo(expected.z, 5);
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
