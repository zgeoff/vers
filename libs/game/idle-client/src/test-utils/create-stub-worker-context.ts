import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ActivityData } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import { resolveServiceURL } from '@vers/mock-services';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import type { RewardSlotLedgerEntry } from '../types';
import type { WorkerContext } from '../worker/types';
import type { WorkerMessage } from '../worker/worker-to-client-message-schema';
import { createStubSubmitter } from './create-stub-submitter';

interface CreateStubWorkerContextOptions {
  readonly broadcast?: (message: WorkerMessage) => void;

  /**
   * The baked engine hash start calls pin, defaulting to undefined — the dev-build shape, where
   * starts land on the registry's current stamp. A test asserting the pinned-hash wire contract
   * passes a value.
   */
  readonly bundledEngineHash?: string;

  readonly client?: ActivityServiceClient;
  readonly failureAction?: ActivityFailureAction;
  readonly remainingBudgetMs?: number;

  /**
   * The runtime-lifetime shutdown controller. A test that simulates worker teardown passes its
   * own controller and aborts it directly.
   */
  readonly shutdownController?: AbortController;

  readonly submitter?: Readonly<CheckpointSubmitter>;
}

export interface StubWorkerContext extends WorkerContext {
  /**
   * Reads the connectivity flag the stub's `updateConnectivity` tracks — the flows under test
   * broadcast nothing on a connectivity change, so this probe is their only observable.
   */
  readonly getConnectivityOnline: () => boolean;

  /**
   * Every message `broadcast` recorded, in arrival order.
   */
  readonly getBroadcasts: () => ReadonlyArray<WorkerMessage>;
}

export function createStubWorkerContext(
  options: Readonly<CreateStubWorkerContextOptions> = {},
): StubWorkerContext {
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
  const shutdownController = options.shutdownController ?? new AbortController();

  let stopController = new AbortController();

  let cancelSignal = AbortSignal.any([stopController.signal, shutdownController.signal]);
  let startToken: null | string = null;
  let lifecycleTail: Readonly<Promise<void>> = Promise.resolve();
  let queuedClaimResync: null | string = null;
  let writerDisplacedActivityID: null | string = null;
  let connectivityOnline = true;
  const broadcasts: Array<WorkerMessage> = [];

  return {
    advanceStopScope: () => {
      stopController.abort();

      stopController = new AbortController();

      cancelSignal = AbortSignal.any([stopController.signal, shutdownController.signal]);
    },
    broadcast: (message) => {
      broadcasts.push(message);
      options.broadcast?.(message);
    },
    getActivity: () => activity,
    getBroadcasts: () => broadcasts,
    getBundledEngineHash: () => options.bundledEngineHash,
    getCancelSignal: () => cancelSignal,
    getClient: () => client,
    getConnectivity: () => connectivityOnline,
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
    getStartToken: () => startToken,
    getStopSignal: () => stopController.signal,
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
    setStartToken: (token) => {
      startToken = token;
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
