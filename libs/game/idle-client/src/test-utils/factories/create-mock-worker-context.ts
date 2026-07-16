import type { Simulation } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../../submission/create-checkpoint-submitter';
import type { RewardSlotLedgerEntry } from '../../types';
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
    registerActivity: () => Promise.resolve(),
    submit: () => Promise.resolve(undefined),
  };

  let simulation: null | Simulation = null;
  let rewardSlotLedgerActivityID: null | string = null;
  let rewardSlotLedger: ReadonlyArray<RewardSlotLedgerEntry> = [];

  return {
    connections,
    getRemainingBudgetMs: () => options.remainingBudgetMs ?? Number.MAX_SAFE_INTEGER,
    getRewardSlotLedger: () => ({
      activityID: rewardSlotLedgerActivityID,
      entries: rewardSlotLedger,
    }),
    getSimulation: () => simulation,
    getSubmitter: () => submitter,
    recordRewardSlots: (activityID, entry) => {
      if (rewardSlotLedgerActivityID === activityID) {
        rewardSlotLedger = [...rewardSlotLedger, entry];

        return;
      }

      rewardSlotLedgerActivityID = activityID;
      rewardSlotLedger = [entry];
    },
    removeConnection: (port) => {
      connections.delete(port);
    },
    setSimulation: (newSimulation) => {
      simulation = newSimulation;
    },
  };
}
