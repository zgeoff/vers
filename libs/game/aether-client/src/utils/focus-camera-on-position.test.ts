import { expect, spyOn, test } from 'bun:test';
import { PerspectiveCamera } from 'three';
import { focusCameraOnPosition } from './focus-camera-on-position';

test('it updates camera position to focus on target', () => {
  const camera = new PerspectiveCamera();

  const updateProjectionMatrixSpy = spyOn(camera, 'updateProjectionMatrix');

  focusCameraOnPosition(camera, [10, 20]);

  // our fixed height
  expect(camera.position.y).toBe(40);

  // adjusted x,z position for an isometric view
  expect(camera.position.x).toBeCloseTo(33.09401076, 7);
  expect(camera.position.z).toBeCloseTo(12.65986323, 7);
  expect(updateProjectionMatrixSpy).toHaveBeenCalledOnce();
});
