import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { removeSharedWorker } from '../../test-utils/remove-shared-worker';
import { useIsSharedWorkerSupported } from './use-is-shared-worker-supported';

test('it reports support when the SharedWorker constructor exists', () => {
  const hook = renderHook(() => useIsSharedWorkerSupported());

  expect(hook.result.current).toBe(true);
});

test('it reports no support when the SharedWorker constructor is absent', () => {
  removeSharedWorker();

  const hook = renderHook(() => useIsSharedWorkerSupported());

  expect(hook.result.current).toBe(false);
});
