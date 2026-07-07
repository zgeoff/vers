import { renderHook } from '@testing-library/react';
import { PerspectiveCamera } from 'three';
import { expect, test } from 'vitest';
import { setCamera } from './set-camera';
import { useCameraStore } from './use-camera-store';

test('it sets a reference to the camera in the store', () => {
  const camera = new PerspectiveCamera();

  setCamera(camera);

  const result = renderHook(() => useCameraStore((state) => state)).result;

  expect(result.current).toStrictEqual({
    camera,
  });
});
