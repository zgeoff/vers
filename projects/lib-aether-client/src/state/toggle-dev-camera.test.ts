import { renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { toggleDevCamera } from './toggle-dev-camera';
import { useIsDevCameraActive } from './use-is-dev-camera-active';

test('it toggles dev camera state from false to true', () => {
  const { rerender, result } = renderHook(() => useIsDevCameraActive());

  expect(result.current).toBeFalse();

  toggleDevCamera();
  rerender();

  expect(result.current).toBeTrue();

  toggleDevCamera();
  rerender();

  expect(result.current).toBeFalse();
});
