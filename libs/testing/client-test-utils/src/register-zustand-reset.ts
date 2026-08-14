import { afterEach, mock } from 'bun:test';
import * as actualZustand from 'zustand';

/**
 * Wires automatic zustand store resets into the current bun-test run: wraps zustand's `create` so
 * every store built through it registers a reset to its initial state, replayed in a global
 * `afterEach`. Call once from a bunfig preload, before any module under test imports `zustand` —
 * `bun test` runs every file in one process with no per-file isolation, so a store mutated in one
 * file otherwise leaks into the next.
 */
export function registerZustandReset(): void {
  // Captured before mock.module swaps the live `zustand` namespace binding; calling
  // actualZustand.create from inside the wrapper below would recurse.
  const actualCreate = actualZustand.create;

  const storeResetFns = new Set<() => void>();

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- wraps zustand's own overloaded generic `create`; the wrapper is call-compatible but structurally distinct from the real signature
  const create = (<T>(stateCreator?: actualZustand.StateCreator<T>) => {
    const createTrackedStore = (creator: actualZustand.StateCreator<T>) => {
      const store = actualCreate(creator);
      const initialState = store.getInitialState();

      storeResetFns.add(() => {
        store.setState(initialState, true);
      });

      return store;
    };

    return typeof stateCreator === 'function'
      ? createTrackedStore(stateCreator)
      : createTrackedStore;
  }) as typeof actualZustand.create;

  // Swaps the live `zustand` namespace binding retroactively, so every already-imported consumer
  // picks up the tracked `create`.
  void mock.module('zustand', () => ({ ...actualZustand, create }));

  afterEach(() => {
    for (const resetFn of storeResetFns) {
      resetFn();
    }
  });
}
