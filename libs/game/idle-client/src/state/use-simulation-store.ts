import { create } from 'zustand';

interface SimulationStore {
  initialized: boolean;
  worker: null | SharedWorker;
}

export const useSimulationStore = create<SimulationStore>()(() => ({
  initialized: false,
  worker: null,
}));
