import { renderHook } from '@testing-library/react';
import { PerspectiveCamera } from 'three';
import { expect, test } from 'vitest';
import { setCamera } from './set-camera';
import { useCamera } from './use-camera';

test('it returns a reference to the current camera', () => {
  const camera = new PerspectiveCamera();

  setCamera(camera);

  const hook = renderHook(() => useCamera());

  expect(hook.result.current).toBe(camera);
});
