import { mock } from 'bun:test';
import * as actualZustand from 'zustand';
import type {
  Mutate,
  StateCreator,
  StoreApi,
  StoreMutatorIdentifier,
  UseBoundStore,
} from 'zustand';

// Captured before mock.module swaps the live `zustand` namespace binding; calling
// actualZustand.create from inside the wrapper below would recurse.
const actualCreate = actualZustand.create;

const storeResetFns = new Set<() => void>();

export function registerZustandReset(): () => void {
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

type Mutators = Array<[StoreMutatorIdentifier, unknown]>;

function create<T, Mos extends Mutators = []>(
  initializer: StateCreator<T, [], Mos>,
): UseBoundStore<Mutate<StoreApi<T>, Mos>>;

function create<T>(): <Mos extends Mutators = []>(
  initializer: StateCreator<T, [], Mos>,
) => UseBoundStore<Mutate<StoreApi<T>, Mos>>;

function create<T, Mos extends Mutators = []>(initializer?: StateCreator<T, [], Mos>) {
  return initializer === undefined ? createTrackedStore : createTrackedStore(initializer);
}

function createTrackedStore<T, Mos extends Mutators = []>(
  initializer: StateCreator<T, [], Mos>,
): UseBoundStore<Mutate<StoreApi<T>, Mos>> {
  // zustand hands the initializer the same store object it returns, typed as the plain store
  // before any middleware type wraps it
  return actualCreate<T, Mos>((setState, getState, store) => {
    storeResetFns.add(() => {
      store.setState(store.getInitialState(), true);
    });

    return initializer(setState, getState, store);
  });
}
