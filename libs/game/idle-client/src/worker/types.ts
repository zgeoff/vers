import type { ActivityData } from '@vers/contract-activity';
import type { ActivityCheckpoint, ActivityFailureAction, Simulation } from '@vers/idle-core';
import type { ActorRefFromLogic } from 'xstate';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import type { RewardSlotLedgerEntry, RewardSlotLedgerSnapshot } from '../types';
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

  readonly getFailureAction: () => ActivityFailureAction;

  readonly getRemainingBudgetMs: () => number;

  readonly getResyncAvatarID: () => string | null;

  readonly getRewardSlotLedger: () => RewardSlotLedgerSnapshot;
  readonly getSimulation: () => Simulation;

  readonly getLatestRun: () => LatestRun | null;

  readonly getLifecycle: () => ActorRefFromLogic<typeof workerLifecycleMachine>;

  readonly getStartToken: () => null | string;

  readonly getCancelSignal: () => AbortSignal;

  readonly getStopSignal: () => AbortSignal;

  readonly getSubmitter: () => CheckpointSubmitter;

  readonly getWriterDisplacedActivityID: () => null | string;

  readonly isFailureActionDirty: () => boolean;

  readonly isFailureActionPushInFlight: () => boolean;

  readonly recordRewardSlots: (activityID: string, entry: RewardSlotLedgerEntry) => void;
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
  readonly setWriterDisplacedActivityID: (activityID: null | string) => void;

  readonly updateConnectivity: (online: boolean) => void;
}
