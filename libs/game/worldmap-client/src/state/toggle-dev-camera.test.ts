import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { toggleDevCamera } from './toggle-dev-camera';
import { useIsDevCameraActive } from './use-is-dev-camera-active';

test('it toggles dev camera state from false to true', () => {
  const hook = renderHook(() => useIsDevCameraActive());

  expect(hook.result.current).toBeFalse();

  toggleDevCamera();

  hook.rerender();

  expect(hook.result.current).toBeTrue();

  toggleDevCamera();

  hook.rerender();

  expect(hook.result.current).toBeFalse();
});
