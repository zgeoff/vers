import type { Simulation } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../../submission/create-checkpoint-submitter';
import type { WorkerContext } from '../../worker/types';

interface CreateMockWorkerContextOptions {
  readonly connections?: ReadonlyArray<MessagePort>;
  readonly remainingBudgetMs?: number;
  readonly submitter?: Readonly<CheckpointSubmitter>;
}

export function createMockWorkerContext(
  options: Readonly<CreateMockWorkerContextOptions> = {},
): WorkerContext {
  const connections = new Set(options.connections);

  const submitter: CheckpointSubmitter = options.submitter ?? {
    flushHeld: () => Promise.resolve(),
    registerActivity: () => Promise.resolve(),
    submit: () => Promise.resolve(),
  };

  let simulation: null | Simulation = null;

  return {
    connections,
    getRemainingBudgetMs: () => options.remainingBudgetMs ?? Number.MAX_SAFE_INTEGER,
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
