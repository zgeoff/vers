import { mock } from 'bun:test';
import * as actualZustand from 'zustand';

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

  // run the returned reset only after every rendered React tree is unmounted: a reset under a live
  // tree re-renders it against the fresh stores, and that render's effects write the outgoing
  // test's state back into them.
  return () => {
    for (const resetFn of storeResetFns) {
      resetFn();
    }
  };
}
