import { useSyncExternalStore } from 'react';
import { isSharedWorkerSupported } from './is-shared-worker-supported';

/**
 * SSR-safe read of SharedWorker support. The server snapshot is always false, so the first client
 * render matches the server and the real value resolves after hydration — a component may gate on
 * this without a hydration mismatch.
 */
export function useIsSharedWorkerSupported(): boolean {
  return useSyncExternalStore(subscribe, isSharedWorkerSupported, getServerSnapshot);
}

function subscribe(): () => void {
  return unsubscribe;
}

function unsubscribe(): void {
  // SharedWorker support is fixed for a page's lifetime, so there is nothing to tear down.
}

function getServerSnapshot(): boolean {
  return false;
}
