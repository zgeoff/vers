import { afterEach, mock } from 'bun:test';
import * as actualZustand from 'zustand';

/**
 * Wires automatic zustand store resets into the current bun-test run: wraps zustand's `create` so
 * every store built through it registers a reset to its initial state, replayed in a global
 * `afterEach`. Call once from a bunfig preload, as early as possible — `bun test` runs every file
 * in one process with no per-file isolation, so a store mutated in one file otherwise leaks into
 * the next, and the wrapping must be installed before any module under test imports `zustand`.
 * `mock.module` swaps the live `zustand` namespace binding retroactively, so the real `create` is
 * captured into a const before it runs, or calling it from inside the wrapper recurses.
 */
export function registerZustandReset(): void {
  const actualCreate = actualZustand.create;

  const storeResetFns = new Set<() => void>();

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- wraps zustand's own overloaded generic `create`; the wrapper is call-compatible but structurally distinct from the real signature
  const create = (<T>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- StateCreator is zustand's own generic callback type; it has no readonly form
    stateCreator?: actualZustand.StateCreator<T>,
  ) => {
    const curried = (
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- StateCreator is zustand's own generic callback type; it has no readonly form
      creator: actualZustand.StateCreator<T>,
    ) => {
      const store = actualCreate(creator);
      const initialState = store.getInitialState();

      storeResetFns.add(() => {
        store.setState(initialState, true);
      });

      return store;
    };

    return typeof stateCreator === 'function' ? curried(stateCreator) : curried;
  }) as typeof actualZustand.create;

  void mock.module('zustand', () => ({ ...actualZustand, create }));

  afterEach(() => {
    for (const resetFn of storeResetFns) {
      resetFn();
    }
  });
}
