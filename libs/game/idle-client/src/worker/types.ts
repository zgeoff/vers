import type { Simulation } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';

/**
 * Accessors over `createWorkerRuntime`'s closure state, threaded to every message and simulation
 * event handler instead of each reaching for a module-level singleton. `connections` is exposed
 * read-only — `removeConnection` is the one mutation a handler needs. `getSubmitter` always
 * returns the same instance — the submitter, unlike the simulation, exists for the runtime's
 * whole lifetime.
 */
export interface WorkerContext {
  readonly connections: ReadonlySet<MessagePort>;
  readonly getSimulation: () => null | Simulation;
  readonly getSubmitter: () => CheckpointSubmitter;
  readonly removeConnection: (port: MessagePort) => void;
  readonly setSimulation: (simulation: null | Simulation) => void;
}
