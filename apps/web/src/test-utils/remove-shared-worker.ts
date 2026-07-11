import { onTestFinished } from 'bun:test';

/**
 * Removes `SharedWorker` from the global scope for the running test — the unsupported-browser
 * path — and restores the placeholder the preload installs once the test finishes.
 */
export function removeSharedWorker(): void {
  const original = globalThis.SharedWorker;

  Reflect.set(globalThis, 'SharedWorker', undefined);

  onTestFinished(() => {
    globalThis.SharedWorker = original;
  });
}
