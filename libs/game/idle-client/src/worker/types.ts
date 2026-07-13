import type { Simulation } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';

/**
 * Accessors over the runtime's closure state, threaded to every message and simulation event
 * handler. `connections` is exposed read-only — `removeConnection` is the one mutation a handler
 * needs. `getSubmitter` always returns the same instance: the submitter exists for the runtime's
 * whole lifetime, where the simulation is created and later replaced.
 */
export interface WorkerContext {
  readonly connections: ReadonlySet<MessagePort>;
  readonly getSimulation: () => null | Simulation;
  readonly getSubmitter: () => CheckpointSubmitter;
  readonly removeConnection: (port: MessagePort) => void;
  readonly setSimulation: (simulation: null | Simulation) => void;
}
