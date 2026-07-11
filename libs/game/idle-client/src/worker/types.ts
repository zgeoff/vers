import type { Simulation } from '@vers/idle-core';

/**
 * Accessors over `createWorkerRuntime`'s closure state, threaded to every message and simulation
 * event handler instead of each reaching for a module-level singleton. `connections` is exposed
 * read-only — `removeConnection` is the one mutation a handler needs.
 */
export interface WorkerContext {
  readonly connections: ReadonlySet<MessagePort>;
  readonly getSimulation: () => null | Simulation;
  readonly removeConnection: (port: MessagePort) => void;
  readonly setSimulation: (simulation: null | Simulation) => void;
}
