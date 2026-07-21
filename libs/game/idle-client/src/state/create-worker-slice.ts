import type { SimulationTransport } from '../types';

export interface WorkerSlice {
  initialized: boolean;
  transport: null | SimulationTransport;

  /**
   * Counts fallback writer promotions, ticking on every writer-ready broadcast. Effects that must
   * run once per writer — the initialize/report-online handshake, a panel's latched start attempt
   * — key on it instead of a once-per-page-load guard, so a promoted writer is greeted like a
   * fresh one. Stays 0 for the SharedWorker transport's whole life.
   */
  writerGeneration: number;
}

export function createWorkerSlice(): WorkerSlice {
  return {
    initialized: false,
    transport: null,
    writerGeneration: 0,
  };
}
