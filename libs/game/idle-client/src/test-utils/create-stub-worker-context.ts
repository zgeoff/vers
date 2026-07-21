import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ActivityData } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import { resolveServiceURL } from '@vers/mock-services';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import type { RewardSlotLedgerEntry } from '../types';
import type { WorkerConnection, WorkerContext } from '../worker/types';
import { createStubSubmitter } from './create-stub-submitter';

interface CreateStubWorkerContextOptions {
  readonly client?: ActivityServiceClient;
  readonly connections?: ReadonlyArray<WorkerConnection>;
  readonly failureAction?: ActivityFailureAction;
  readonly remainingBudgetMs?: number;
  readonly submitter?: Readonly<CheckpointSubmitter>;
}

export interface StubWorkerContext extends WorkerContext {
  /**
   * Reads the connectivity flag the stub's `updateConnectivity` tracks — the flows under test
   * broadcast nothing on a connectivity change, so this probe is their only observable.
   */
  readonly getConnectivityOnline: () => boolean;
}

export function createStubWorkerContext(
  options: Readonly<CreateStubWorkerContextOptions> = {},
): StubWorkerContext {
  const connections = new Set(options.connections);

  const client: ActivityServiceClient =
    options.client ??
    createORPCClient(new RPCLink({ url: `${resolveServiceURL('activity')}/rpc` }));

  const submitter: CheckpointSubmitter = options.submitter ?? createStubSubmitter();
  let simulation: Simulation = createSimulation();
  let activity: ActivityData | null = null;
  let resyncAvatarID: string | null = null;
  let resyncInFlight = false;
  let rewardSlotLedgerActivityID: null | string = null;
  let rewardSlotLedger: ReadonlyArray<RewardSlotLedgerEntry> = [];
  let failureAction: ActivityFailureAction = options.failureAction ?? ActivityFailureAction.Abort;
  let failureActionDirty = false;
  let failureActionPushInFlight = false;
  let stopEpoch = 0;
  let startRequestID: null | string = null;
  let lifecycleTail: Readonly<Promise<void>> = Promise.resolve();
  let queuedClaimResync: null | string = null;
  let writerDisplacedActivityID: null | string = null;
  let connectivityOnline = true;

  return {
    advanceStopEpoch: () => {
      stopEpoch += 1;
    },
    connections,
    getActivity: () => activity,
    getClient: () => client,
    getConnectivityOnline: () => connectivityOnline,
    getFailureAction: () => failureAction,
    getRemainingBudgetMs: () => options.remainingBudgetMs ?? Number.MAX_SAFE_INTEGER,
    getResyncAvatarID: () => resyncAvatarID,
    getRewardSlotLedger: () => ({
      activityID: rewardSlotLedgerActivityID,
      entries: rewardSlotLedger,
    }),
    getSimulation: () => simulation,
    getLifecycleTail: () => lifecycleTail,
    getQueuedClaimResync: () => queuedClaimResync,
    getStartRequestID: () => startRequestID,
    getStopEpoch: () => stopEpoch,
    getSubmitter: () => submitter,
    getWriterDisplacedActivityID: () => writerDisplacedActivityID,
    isFailureActionDirty: () => failureActionDirty,
    isFailureActionPushInFlight: () => failureActionPushInFlight,
    isResyncInFlight: () => resyncInFlight,
    recordRewardSlots: (activityID, entry) => {
      if (rewardSlotLedgerActivityID === activityID) {
        rewardSlotLedger = [...rewardSlotLedger, entry];

        return;
      }

      rewardSlotLedgerActivityID = activityID;
      rewardSlotLedger = [entry];
    },
    removeConnection: (connection) => {
      connections.delete(connection);
    },
    resetRewardSlotLedger: () => {
      rewardSlotLedgerActivityID = null;
      rewardSlotLedger = [];
    },
    setActivity: (newActivity) => {
      activity = newActivity;
    },
    setFailureAction: (action) => {
      failureAction = action;
    },
    setFailureActionDirty: (dirty) => {
      failureActionDirty = dirty;
    },
    setFailureActionPushInFlight: (inFlight) => {
      failureActionPushInFlight = inFlight;
    },
    setQueuedClaimResync: (avatarID) => {
      queuedClaimResync = avatarID;
    },
    setResyncAvatarID: (avatarID) => {
      resyncAvatarID = avatarID;
    },
    setResyncInFlight: (inFlight) => {
      resyncInFlight = inFlight;
    },
    setLifecycleTail: (flow) => {
      lifecycleTail = flow;
    },
    setStartRequestID: (requestID) => {
      startRequestID = requestID;
    },
    setSimulation: (newSimulation) => {
      simulation = newSimulation;
    },
    setWriterDisplacedActivityID: (activityID) => {
      writerDisplacedActivityID = activityID;
    },
    updateConnectivity: (online) => {
      connectivityOnline = online;
    },
  };
}
