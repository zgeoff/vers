import { expect, test } from 'bun:test';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { PerspectiveCamera } from 'three';
import { setCamera } from '../state/set-camera';
import { useWorldmapStore } from '../state/use-worldmap-store';
import { buildViewportFromCamera } from '../utils/build-viewport-from-camera';
import { ViewportTracker } from './viewport-tracker';

function createGroundCamera() {
  const camera = new PerspectiveCamera(90, 1, 0.1, 1000);

  camera.position.set(0, 10, 0);
  camera.rotation.set(-Math.PI / 2, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  return camera;
}

test('it writes the viewport once when a positioned camera first reports its bounds', async () => {
  const camera = createGroundCamera();

  setCamera(camera);

  let writeCount = 0;

  const unsubscribe = useWorldmapStore.subscribe(() => {
    writeCount += 1;
  });

  const renderer = await ReactThreeTestRenderer.create(<ViewportTracker />);

  await renderer.advanceFrames(1, 1);

  unsubscribe();

  expect(writeCount).toBe(1);
  expect(useWorldmapStore.getState().viewport).toStrictEqual(buildViewportFromCamera(camera));
});

test('it writes nothing when the camera moves within the same quantized cell bounds', async () => {
  const camera = createGroundCamera();

  setCamera(camera);

  const renderer = await ReactThreeTestRenderer.create(<ViewportTracker />);

  await renderer.advanceFrames(1, 1);

  const writtenViewport = useWorldmapStore.getState().viewport;
  let writeCount = 0;

  const unsubscribe = useWorldmapStore.subscribe(() => {
    writeCount += 1;
  });

  camera.position.x += 0.001;

  camera.updateMatrixWorld(true);

  await renderer.advanceFrames(3, 1);

  unsubscribe();

  expect(writeCount).toBe(0);
  expect(useWorldmapStore.getState().viewport).toStrictEqual(writtenViewport);
});

test('it writes again once the camera crosses into new quantized cell bounds', async () => {
  const camera = createGroundCamera();

  setCamera(camera);

  const renderer = await ReactThreeTestRenderer.create(<ViewportTracker />);

  await renderer.advanceFrames(1, 1);

  let writeCount = 0;

  const unsubscribe = useWorldmapStore.subscribe(() => {
    writeCount += 1;
  });

  camera.position.x += 100;

  camera.updateMatrixWorld(true);

  await renderer.advanceFrames(1, 1);

  unsubscribe();

  expect(writeCount).toBe(1);
  expect(useWorldmapStore.getState().viewport).toStrictEqual(buildViewportFromCamera(camera));
});
