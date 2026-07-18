import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ActivityData } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { resolveServiceURL } from '@vers/mock-services';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import type { RewardSlotLedgerEntry } from '../types';
import type { WorkerContext } from '../worker/types';

interface CreateStubWorkerContextOptions {
  readonly client?: ActivityServiceClient;
  readonly connections?: ReadonlyArray<MessagePort>;
  readonly remainingBudgetMs?: number;
  readonly submitter?: Readonly<CheckpointSubmitter>;
}

export function createStubWorkerContext(
  options: Readonly<CreateStubWorkerContextOptions> = {},
): WorkerContext {
  const connections = new Set(options.connections);

  const client: ActivityServiceClient =
    options.client ??
    createORPCClient(new RPCLink({ url: `${resolveServiceURL('activity')}/rpc` }));

  const submitter: CheckpointSubmitter = options.submitter ?? {
    flushHeld: () => Promise.resolve(),
    flushNow: () => Promise.resolve(),
    registerActivity: () => Promise.resolve(),
    submit: () => Promise.resolve(undefined),
  };

  let simulation: null | Simulation = null;
  let activity: ActivityData | null = null;
  let resyncAvatarID: string | null = null;
  let resyncInFlight = false;
  let rewardSlotLedgerActivityID: null | string = null;
  let rewardSlotLedger: ReadonlyArray<RewardSlotLedgerEntry> = [];

  return {
    connections,
    getActivity: () => activity,
    getClient: () => client,
    getRemainingBudgetMs: () => options.remainingBudgetMs ?? Number.MAX_SAFE_INTEGER,
    getResyncAvatarID: () => resyncAvatarID,
    getRewardSlotLedger: () => ({
      activityID: rewardSlotLedgerActivityID,
      entries: rewardSlotLedger,
    }),
    getSimulation: () => simulation,
    getSubmitter: () => submitter,
    isResyncInFlight: () => resyncInFlight,
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
    setActivity: (newActivity) => {
      activity = newActivity;
    },
    setResyncAvatarID: (avatarID) => {
      resyncAvatarID = avatarID;
    },
    setResyncInFlight: (inFlight) => {
      resyncInFlight = inFlight;
    },
    setSimulation: (newSimulation) => {
      simulation = newSimulation;
    },
  };
}
