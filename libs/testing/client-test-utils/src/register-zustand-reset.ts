import { mock } from 'bun:test';
import * as actualZustand from 'zustand';

/**
 * Wires zustand store tracking into the current bun-test run: wraps zustand's `create` so every
 * store built through it can be reset to its initial state by the returned function. Call once
 * from a bunfig preload, before any module under test imports `zustand` — `bun test` runs every
 * file in one process with no per-file isolation, so a store mutated in one file otherwise leaks
 * into the next.
 *
 * The caller owns the teardown hook: run the returned reset in its `afterEach`, strictly after
 * unmounting any rendered React tree. A reset while a tree is still mounted re-renders it against
 * the freshly reset stores, and whatever that render's effects write back leaks the outgoing
 * test's state into the next one.
 */
export function registerZustandReset(): () => void {
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

  return () => {
    for (const resetFn of storeResetFns) {
      resetFn();
    }
  };
}
