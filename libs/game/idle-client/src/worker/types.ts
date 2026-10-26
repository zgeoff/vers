import type { ActivityData } from '@vers/contract-activity';
import type { ActivityCheckpoint, ActivityFailureAction, Simulation } from '@vers/idle-core';
import type { ActorRefFromLogic } from 'xstate';
import type { checkpointSubmitterMachine } from '../submission/checkpoint-submitter-machine';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import type { RewardSlotLedgerEntry, RewardSlotLedgerSnapshot } from '../types';
import type { Deferred } from './build-deferred';
import type { DebugRecorder } from './create-debug-recorder';
import type { StartStatus } from './worker-contract';
import type { workerLifecycleMachine } from './worker-lifecycle-machine';
import type { WorkerMessage } from './worker-to-client-message-schema';

export interface WorkerCallContext {
  readonly close: () => void;
}

export interface FlowSignals {
  readonly cancel: AbortSignal;
  readonly stop: AbortSignal;
}

export interface StartActivityInput {
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

export interface StopActivityInput {
  readonly activityID: string;
  readonly avatarID: string;
}

export interface LatestRun {
  readonly activityID: string;
  readonly avatarID: string;
  readonly baselineXP: number;
  readonly deltaXP: number;
  readonly tail: ActivityCheckpoint | null;
}

export interface WorkerContext {
  readonly advanceStopScope: () => void;

  readonly broadcast: (message: WorkerMessage) => void;

  readonly getActivity: () => ActivityData | null;

  readonly getBundledEngineHash: () => string | undefined;

  readonly getClient: () => ActivityServiceClient;

  readonly getConnectivityOnline: () => boolean;

  readonly getDebugRecorder: () => DebugRecorder;

  readonly getFailureAction: () => ActivityFailureAction;

  readonly getRemainingBudgetMs: () => number;

  readonly getResyncAvatarID: () => string | null;

  readonly getRewardSlotLedger: () => RewardSlotLedgerSnapshot;
  readonly getSimulation: () => Simulation;

  readonly getSimulationSpeed: () => number;

  readonly getLatestRun: () => LatestRun | null;

  readonly getLifecycle: () => ActorRefFromLogic<typeof workerLifecycleMachine>;

  readonly getStartToken: () => null | string;

  readonly getCancelSignal: () => AbortSignal;

  readonly getStopSignal: () => AbortSignal;

  readonly getSubmitter: () => CheckpointSubmitter;

  readonly getWriterDisplacedActivityID: () => null | string;

  readonly hasReconstructed: (avatarID: string) => boolean;

  readonly isFailureActionDirty: () => boolean;

  readonly isFailureActionPushInFlight: () => boolean;

  readonly recordRewardSlots: (activityID: string, entry: RewardSlotLedgerEntry) => void;

  readonly registerReconstruction: (avatarID: string) => void;

  readonly resetRewardSlotLedger: () => void;
  readonly setActivity: (activity: ActivityData | null) => void;
  readonly setFailureAction: (action: ActivityFailureAction) => void;
  readonly setFailureActionDirty: (dirty: boolean) => void;
  readonly setFailureActionPushInFlight: (inFlight: boolean) => void;

  readonly setLastAckAt: (timestamp: number) => void;

  readonly setLatestRun: (run: LatestRun | null) => void;

  readonly setResyncAvatarID: (avatarID: null | string) => void;
  readonly setStartToken: (token: string) => void;
  readonly setSimulation: (simulation: Simulation) => void;
  readonly setSimulationSpeed: (speed: number) => void;
  readonly setWriterDisplacedActivityID: (activityID: null | string) => void;

  readonly stopTicking: () => void;

  readonly updateConnectivity: (online: boolean) => void;

  readonly writeMintedActivityStart: (row: Readonly<ActivityData>) => Promise<void>;
}

export type DiscardTrigger =
  | {
      readonly kind: 'sign-out';
      readonly avatarIDs: ReadonlyArray<string>;
      readonly deferred: Deferred<void>;
    }
  | { readonly kind: 'takeover' };

export type PendingFlowRequest =
  | {
      readonly kind: 'start';
      readonly awaitedResync: boolean;
      readonly input: Readonly<StartActivityInput>;
      readonly token: string;
      readonly deferred: Deferred<StartStatus>;
    }
  | {
      readonly kind: 'resync';
      readonly avatarID: string;
      readonly claim: boolean;
      readonly signals: Readonly<FlowSignals>;
      readonly deferred: Deferred<void>;
      readonly carryOverDeferreds: ReadonlyArray<Deferred<void>>;
    }
  | {
      readonly kind: 'continuation';
      readonly simulation: Simulation;
      readonly activity: Readonly<ActivityData>;
      readonly deferred: Deferred<void>;
    }
  | { readonly kind: 'discard'; readonly trigger: DiscardTrigger }
  | { readonly kind: 'eviction'; readonly activityID: string };

export type DiscardOutcome =
  | { readonly kind: 'done' }
  | { readonly kind: 'failed'; readonly error: unknown };

export type PendingFlowRequestOf<K extends PendingFlowRequest['kind']> = Extract<
  PendingFlowRequest,
  { readonly kind: K }
>;

type WorkerLifecyclePhase =
  | 'continuing'
  | 'discarding'
  | 'evicting'
  | 'idle'
  | 'resyncing'
  | 'running'
  | 'starting'
  | 'stopping';

interface ResyncTicket {
  readonly pendingClaimAvatarID: string | null;
}

export interface WorkerLifecycleContext {
  readonly cancelSignal: AbortSignal;
  readonly currentRequest: PendingFlowRequest | null;
  readonly failureActionSeeded: Promise<void>;
  readonly pending: ReadonlyArray<PendingFlowRequest>;
  readonly phase: WorkerLifecyclePhase;
  readonly resyncTicket: ResyncTicket | null;
  readonly runtime: WorkerContext;
  readonly shutdownSignal: AbortSignal;
  readonly startToken: string | null;
  readonly stopController: AbortController;

  // written inline rather than behind a local alias: the readonly-parameters lint exempts the
  // xstate ref by its own name, and an alias would hide it from that match
  readonly submitterRef: ActorRefFromLogic<typeof checkpointSubmitterMachine>;
  readonly writerDisplacedActivityID: string | null;
}

export interface WorkerLifecycleInput {
  readonly failureActionSeeded: Promise<void>;
  readonly runtime: WorkerContext;
  readonly shutdownSignal: AbortSignal;
}

export type WorkerLifecycleEvent =
  | { readonly type: 'ADVANCE_STOP_SCOPE' }
  | {
      readonly type: 'CONTINUATION';
      readonly simulation: Simulation;
      readonly activity: Readonly<ActivityData>;
      readonly deferred: Deferred<void>;
    }
  | { readonly type: 'DISCARD'; readonly trigger: DiscardTrigger }
  | { readonly type: 'OFFLINE' }
  | { readonly type: 'ONLINE' }
  | {
      readonly type: 'RESYNC';
      readonly avatarID: string;
      readonly claim: boolean;
      readonly deferred: Deferred<void>;
    }
  | { readonly type: 'SET_START_TOKEN'; readonly token: string }
  | { readonly type: 'SET_WRITER_DISPLACED'; readonly activityID: string | null }
  | {
      readonly type: 'START';
      readonly input: Readonly<StartActivityInput>;
      readonly deferred: Deferred<StartStatus>;
    }
  | {
      readonly type: 'STOP_ACTIVITY';
      readonly input: Readonly<StopActivityInput>;
      readonly deferred: Deferred<void>;
    }
  | { readonly type: 'STOP_DELIVERY_DONE' }
  | { readonly type: 'SUBMITTER_ACKED' }
  | { readonly type: 'SUBMITTER_CAPPED' }
  | { readonly type: 'SUBMITTER_EVICTED'; readonly activityID: string }
  | { readonly type: 'SUBMITTER_HELD' }
  | { readonly type: 'SUBMITTER_JOURNAL_FAILED' }
  | { readonly type: 'SUBMITTER_SERVER_CONTACT' };
