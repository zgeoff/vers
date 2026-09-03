import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ActivityData } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { ActivityFailureAction, createSimulation } from '@vers/idle-core';
import { resolveServiceURL } from '@vers/mock-services';
import type { ActorRefFromLogic } from 'xstate';
import { createActor } from 'xstate';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import type { RewardSlotLedgerEntry } from '../types';
import type { RunEarnings, WorkerContext } from '../worker/types';
import { workerLifecycleMachine } from '../worker/worker-lifecycle-machine';
import type { WorkerMessage } from '../worker/worker-to-client-message-schema';
import { createStubSubmitter } from './create-stub-submitter';

interface CreateStubWorkerContextOptions {
  readonly broadcast?: (message: WorkerMessage) => void;

  readonly bundledEngineHash?: string;

  readonly client?: ActivityServiceClient;
  readonly failureAction?: ActivityFailureAction;
  readonly remainingBudgetMs?: number;

  readonly shutdownController?: AbortController;

  readonly submitter?: Readonly<CheckpointSubmitter>;
}

export interface StubWorkerContext extends WorkerContext {
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
  let rewardSlotLedgerActivityID: null | string = null;
  let rewardSlotLedger: ReadonlyArray<RewardSlotLedgerEntry> = [];
  let runEarnings: RunEarnings | null = null;
  let failureAction: ActivityFailureAction = options.failureAction ?? ActivityFailureAction.Abort;
  let failureActionDirty = false;
  let failureActionPushInFlight = false;
  const shutdownController = options.shutdownController ?? new AbortController();
  let connectivityOnline = true;
  const broadcasts: Array<WorkerMessage> = [];

  // referenced by `context.getLifecycle` below via closure before it exists, safe only because
  // nothing calls it until after the `const lifecycleActor` assignment following `context` runs
  const getLifecycle = (): ActorRefFromLogic<typeof workerLifecycleMachine> => lifecycleActor;

  const context: StubWorkerContext = {
    advanceStopScope: () => {
      getLifecycle().send({ type: 'ADVANCE_STOP_SCOPE' });
    },
    broadcast: (message) => {
      broadcasts.push(message);
      options.broadcast?.(message);
    },
    getActivity: () => activity,
    getBroadcasts: () => broadcasts,
    getBundledEngineHash: () => options.bundledEngineHash,
    getCancelSignal: () => getLifecycle().getSnapshot().context.cancelSignal,
    getClient: () => client,
    getConnectivityOnline: () => connectivityOnline,
    getFailureAction: () => failureAction,
    getLifecycle,
    getRemainingBudgetMs: () => options.remainingBudgetMs ?? Number.MAX_SAFE_INTEGER,
    getResyncAvatarID: () => resyncAvatarID,
    getRewardSlotLedger: () => ({
      activityID: rewardSlotLedgerActivityID,
      entries: rewardSlotLedger,
    }),
    getRunEarnings: () => runEarnings,
    getSimulation: () => simulation,
    getStartToken: () => getLifecycle().getSnapshot().context.startToken,
    getStopSignal: () => getLifecycle().getSnapshot().context.stopController.signal,
    getSubmitter: () => submitter,
    getWriterDisplacedActivityID: () =>
      getLifecycle().getSnapshot().context.writerDisplacedActivityID,
    isFailureActionDirty: () => failureActionDirty,
    isFailureActionPushInFlight: () => failureActionPushInFlight,
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

    // the stub's budget is entirely test-controlled through `options.remainingBudgetMs`, so
    // there is no anchor timestamp here for an ack to move
    setLastAckAt: () => {},
    setResyncAvatarID: (avatarID) => {
      resyncAvatarID = avatarID;
    },
    setRunEarnings: (earnings) => {
      runEarnings = earnings;
    },
    setSimulation: (newSimulation) => {
      simulation = newSimulation;
    },
    setStartToken: (token) => {
      getLifecycle().send({ token, type: 'SET_START_TOKEN' });
    },
    setWriterDisplacedActivityID: (activityID) => {
      getLifecycle().send({ activityID, type: 'SET_WRITER_DISPLACED' });
    },
    updateConnectivity: (online) => {
      connectivityOnline = online;
    },
  };

  const lifecycleActor = createActor(workerLifecycleMachine, {
    input: {
      failureActionSeeded: Promise.resolve(),
      runtime: context,
      shutdownSignal: shutdownController.signal,
    },
  }).start();

  return context;
}
