import { create } from 'zustand';
import type { SimulationSlice } from './create-simulation-slice';
import { createSimulationSlice } from './create-simulation-slice';
import type { SyncSlice } from './create-sync-slice';
import { createSyncSlice } from './create-sync-slice';
import type { WorkerSlice } from './create-worker-slice';
import { createWorkerSlice } from './create-worker-slice';

type IdleStore = SimulationSlice & SyncSlice & WorkerSlice;

export const useIdleStore = create<IdleStore>()(() => ({
  ...createSimulationSlice(),
  ...createSyncSlice(),
  ...createWorkerSlice(),
}));
