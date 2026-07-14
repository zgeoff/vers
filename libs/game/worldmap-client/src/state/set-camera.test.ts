import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { PerspectiveCamera } from 'three';
import { setCamera } from './set-camera';
import { useWorldmapStore } from './use-worldmap-store';

test('it sets a reference to the camera in the store', () => {
  const camera = new PerspectiveCamera();

  setCamera(camera);

  const hook = renderHook(() => useWorldmapStore((state) => state.camera));

  expect(hook.result.current).toBe(camera);
});
