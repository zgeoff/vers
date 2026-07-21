import { expect, test } from 'bun:test';
import { createSimulationSlice } from './create-simulation-slice';
import { createSyncSlice } from './create-sync-slice';
import { createWorkerSlice } from './create-worker-slice';
import { useIdleStore } from './use-idle-store';

test('it composes every slice into one store', () => {
  // the worker slice's `writerAbortController` is a mutable instance, not compared by value —
  // `advanceWriterGeneration` calls `.abort()` on whatever the current one is process-wide, so a
  // fresh comparison instance never strict-equals it once any test anywhere has advanced a
  // generation
  const { writerAbortController: _initialController, ...initialWorkerFields } = createWorkerSlice();

  const { writerAbortController: _actualController, ...actualWorkerFields } =
    useIdleStore.getInitialState();

  expect(actualWorkerFields).toStrictEqual({
    ...createSimulationSlice(),
    ...createSyncSlice(),
    ...initialWorkerFields,
  });

  expect(useIdleStore.getInitialState().writerAbortController).toBeInstanceOf(AbortController);
});
