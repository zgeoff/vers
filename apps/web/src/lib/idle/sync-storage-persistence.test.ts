import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useStoragePersistence } from '@vers/idle-client';
import { syncStoragePersistence } from './sync-storage-persistence';

test('it records a granted persistence request', async () => {
  await syncStoragePersistence({ persist: () => Promise.resolve(true) });

  const hook = renderHook(() => useStoragePersistence());

  expect(hook.result.current).toBe('granted');
});

test('it records a refused persistence request', async () => {
  await syncStoragePersistence({ persist: () => Promise.resolve(false) });

  const hook = renderHook(() => useStoragePersistence());

  expect(hook.result.current).toBe('denied');
});

test('it records storage as unavailable when the browser has no persistence API', async () => {
  await syncStoragePersistence(undefined);

  const hook = renderHook(() => useStoragePersistence());

  expect(hook.result.current).toBe('unavailable');
});

test('it records storage as unavailable when the request itself fails', async () => {
  await syncStoragePersistence({ persist: () => Promise.reject(new Error('blocked')) });

  const hook = renderHook(() => useStoragePersistence());

  expect(hook.result.current).toBe('unavailable');
});
