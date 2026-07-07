import { renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { useIsDevCameraActive } from './use-is-dev-camera-active';

test('it returns the current is dev camera active state', () => {
  const result = renderHook(() => useIsDevCameraActive()).result;

  expect(result.current).toBeFalse();
});
