import { expect, test } from 'bun:test';
import { createSimulationSlice } from './create-simulation-slice';
import { createSyncSlice } from './create-sync-slice';
import { createWorkerSlice } from './create-worker-slice';
import { useIdleStore } from './use-idle-store';

test('it composes every slice into one store', () => {
  // `writerAbortController` is a mutable instance: advancing a writer generation anywhere in the
  // process aborts the current one, so a fresh comparison instance never strict-equals it
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
