import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useIsDevCameraActive } from './use-is-dev-camera-active';

test('it returns the current is dev camera active state', () => {
  const hook = renderHook(() => useIsDevCameraActive());

  expect(hook.result.current).toBeFalse();
});
