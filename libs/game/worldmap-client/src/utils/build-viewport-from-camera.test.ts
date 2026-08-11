import { expect, test } from 'bun:test';
import { REVEAL_VIEWPORT_CELL_CAP } from '@vers/contract-activity';
import { WORLD_COORD_MAX, WORLD_COORD_MIN } from '@vers/worldmap-core';
import { PerspectiveCamera } from 'three';
import { CAMERA_ROTATION_X, CAMERA_ROTATION_Y, ZOOM_MAX_DISTANCE } from '../consts';
import { buildViewportFromCamera } from './build-viewport-from-camera';

test('it derives the ground footprint of a camera looking straight down', () => {
  const camera = new PerspectiveCamera(90, 1, 0.1, 1000);

  camera.position.set(0, 10, 0);
  camera.rotation.set(-Math.PI / 2, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  expect(buildViewportFromCamera(camera)).toStrictEqual({
    maxCX: 2,
    maxCY: 2,
    minCX: -2,
    minCY: -2,
  });
});

test('it clamps a footprint past the positive coordinate range to the lattice maximum', () => {
  const camera = new PerspectiveCamera(90, 1, 0.1, 1000);

  camera.position.set((WORLD_COORD_MAX + 1000) * 10 * Math.sqrt(3), 10, 0);
  camera.rotation.set(-Math.PI / 2, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  expect(buildViewportFromCamera(camera).maxCX).toBe(WORLD_COORD_MAX);
});

test('it clamps a footprint past the negative coordinate range to the lattice minimum', () => {
  const camera = new PerspectiveCamera(90, 1, 0.1, 1000);

  camera.position.set(0, 10, (Math.abs(WORLD_COORD_MIN) + 1000) * 10 * 1.5);
  camera.rotation.set(-Math.PI / 2, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  expect(buildViewportFromCamera(camera).minCY).toBe(WORLD_COORD_MIN);
});

test('it throws when a frustum corner ray never reaches the ground plane', () => {
  const camera = new PerspectiveCamera(90, 1, 0.1, 1000);

  camera.position.set(0, 10, 0);
  camera.rotation.set(Math.PI / 2, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  expect(() => buildViewportFromCamera(camera)).toThrow(
    'camera frustum corner ray never reaches the ground plane',
  );
});

test('it keeps every viewport within the zoom limit under the reveal query cell cap', () => {
  const radius = ZOOM_MAX_DISTANCE / Math.SQRT2;

  const camera = new PerspectiveCamera(50, 21 / 9, 0.1, 1000);

  camera.position.set(
    radius * Math.sin(CAMERA_ROTATION_Y),
    radius,
    radius * Math.cos(CAMERA_ROTATION_Y),
  );

  camera.rotation.set(CAMERA_ROTATION_X, CAMERA_ROTATION_Y, 0, 'YXZ');
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const viewport = buildViewportFromCamera(camera);
  const cellCount = (viewport.maxCX - viewport.minCX + 1) * (viewport.maxCY - viewport.minCY + 1);

  expect(cellCount).toBeLessThanOrEqual(REVEAL_VIEWPORT_CELL_CAP);
});
