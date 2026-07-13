import type { Simulation } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { WorkerContext } from '../worker/types';

interface CreateMockWorkerContextOptions {
  readonly connections?: ReadonlyArray<MessagePort>;
  readonly submitter?: Readonly<CheckpointSubmitter>;
}

/**
 * A `WorkerContext` double backed by working connection and simulation closures over its own
 * state. The submitter defaults to resolved-promise stubs; a test asserting on submission passes
 * its own spy submitter.
 */
export function createMockWorkerContext(
  options: Readonly<CreateMockWorkerContextOptions> = {},
): WorkerContext {
  const connections = new Set(options.connections);

  const submitter: CheckpointSubmitter = options.submitter ?? {
    attach: () => Promise.resolve(),
    submit: () => Promise.resolve(),
  };

  let simulation: null | Simulation = null;

  return {
    connections,
    getSimulation: () => simulation,
    getSubmitter: () => submitter,
    removeConnection: (port) => {
      connections.delete(port);
    },
    setSimulation: (newSimulation) => {
      simulation = newSimulation;
    },
  };
}
