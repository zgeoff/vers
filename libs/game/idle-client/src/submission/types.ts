import type { ContractRouterClient } from '@orpc/contract';
import type {
  ActivityData,
  CheckpointBatchEntry,
  ContentDocument,
  EncounterNode,
  NodeSeed,
  activityContract,
} from '@vers/contract-activity';
import type { ActivityFailureAction } from '@vers/idle-core';
import type { DBSchema } from 'idb';

export interface QueuedCheckpoint extends CheckpointBatchEntry {
  readonly activityID: string;
}

export interface FailureActionPreference {
  readonly avatarID: string;
  readonly dirty: boolean;
  readonly failureAction: ActivityFailureAction;
}

export interface PendingStopIntent {
  readonly activityID: string;
  readonly avatarID: string;
}

export interface LastStartedActivityPreference {
  readonly avatarID: string;
  readonly lastActivityID: string;
}

export interface NodeSeedAnchor {
  readonly chainIndex: number;
  readonly nextSeed: string;
}

export interface RevealedNodeSeed {
  readonly contentVersion: string;
  readonly encounterNode: EncounterNode;
  readonly genesisSeed: string;
  readonly anchor: NodeSeedAnchor;
  readonly nodeID: string;
}

export interface StartStampsPreference {
  readonly keyVersion: number;
  readonly secretRef: string;
  readonly secretVersion: number;
}

export type { NodeSeed } from '@vers/contract-activity';

export interface CheckpointQueueSchema extends DBSchema {
  'content-documents': {
    key: string;
    value: ContentDocument;
  };
  'node-seeds': {
    key: [string, string];
    value: NodeSeed;
  };
  'pending-checkpoints': {
    key: [string, number];
    value: QueuedCheckpoint;
  };
  'pending-activity-starts': {
    key: string;
    value: ActivityData;
  };

  'pending-roots': {
    key: string;
    value: ActivityData;
  };
  preferences: {
    key: string;
    value:
      | FailureActionPreference
      | LastStartedActivityPreference
      | PendingStopIntent
      | StartStampsPreference;
  };
}

export interface ActivityCallContext {
  readonly traceparent?: string;
}

export type ActivityServiceClient = ContractRouterClient<
  typeof activityContract,
  ActivityCallContext
>;

export interface ActivitySubmissionContext {
  readonly activityID: string;
  readonly appendedHead: number;
  readonly avatarID?: string;
  readonly lastHash: string;
  readonly previousNextSeed?: string;
  readonly scopeID?: string;
  readonly startChainIndex: number;
}
