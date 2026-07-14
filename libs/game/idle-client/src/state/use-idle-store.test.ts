import { expect, test } from 'bun:test';
import { createSimulationSlice } from './create-simulation-slice';
import { createSyncSlice } from './create-sync-slice';
import { createWorkerSlice } from './create-worker-slice';
import { useIdleStore } from './use-idle-store';

test('it composes every slice into one store', () => {
  expect(useIdleStore.getInitialState()).toStrictEqual({
    ...createSimulationSlice(),
    ...createSyncSlice(),
    ...createWorkerSlice(),
  });
});
