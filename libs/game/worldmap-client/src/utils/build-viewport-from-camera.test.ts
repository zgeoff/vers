import { expect, test } from 'bun:test';
import { REVEAL_VIEWPORT_CELL_CAP } from '@vers/contract-activity';
import { WORLD_COORD_MAX, WORLD_COORD_MIN } from '@vers/worldmap-core';
import { PerspectiveCamera } from 'three';
import invariant from 'tiny-invariant';
import { CAMERA_ROTATION_X, CAMERA_ROTATION_Y, ZOOM_MAX_DISTANCE } from '../consts';
import { buildChunkAlignedViewport } from './build-chunk-aligned-viewport';
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

  expect(buildViewportFromCamera(camera)?.maxCX).toBe(WORLD_COORD_MAX);
});

test('it clamps a footprint past the negative coordinate range to the lattice minimum', () => {
  const camera = new PerspectiveCamera(90, 1, 0.1, 1000);

  camera.position.set(0, 10, (Math.abs(WORLD_COORD_MIN) + 1000) * 10 * 1.5);
  camera.rotation.set(-Math.PI / 2, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  expect(buildViewportFromCamera(camera)?.minCY).toBe(WORLD_COORD_MIN);
});

test('it returns null when a frustum corner ray never reaches the ground plane', () => {
  const camera = new PerspectiveCamera(90, 1, 0.1, 1000);

  camera.position.set(0, 10, 0);
  camera.rotation.set(Math.PI / 2, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  expect(buildViewportFromCamera(camera)).toBeNull();
});

test('it keeps every chunk-aligned viewport within the zoom limit under the reveal query cell cap', () => {
  const radius = ZOOM_MAX_DISTANCE / Math.SQRT2;
  const aspect = 32 / 9;

  // a chunk is 16 cells and a cell spans about 17 scene units, so a 300-unit sweep on each axis
  // covers a full chunk period: every phase the footprint can land at against the chunk grid
  const offsets = Array.from({ length: 151 }, (_, index) => index * 2);

  const cellCounts = offsets.flatMap((offsetX) =>
    offsets.map((offsetZ) => {
      const camera = new PerspectiveCamera(50, aspect, 0.1, 1000);

      camera.position.set(
        radius * Math.sin(CAMERA_ROTATION_Y) + offsetX,
        radius,
        radius * Math.cos(CAMERA_ROTATION_Y) + offsetZ,
      );

      camera.rotation.set(CAMERA_ROTATION_X, CAMERA_ROTATION_Y, 0, 'YXZ');
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      const footprint = buildViewportFromCamera(camera);

      invariant(footprint, 'a camera at the isometric tilt always has a ground footprint');

      const viewport = buildChunkAlignedViewport(footprint);

      return (viewport.maxCX - viewport.minCX + 1) * (viewport.maxCY - viewport.minCY + 1);
    }),
  );

  expect(Math.max(...cellCounts)).toBeLessThanOrEqual(REVEAL_VIEWPORT_CELL_CAP);
});
