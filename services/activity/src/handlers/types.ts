import type {
  AdvanceCheckpointInvalidReason,
  CatchUpContinuation,
  ConflictReason,
  ContentDocument,
  EncounterNode,
  OfflineActivityStartSubmission,
} from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import type { Activities, ActivityStatus, DB } from '@vers/db';
import type { CryptoKey } from 'jose';
import type { Kysely, Selectable } from 'kysely';
import type {
  AdvanceBailPayload,
  AdvanceCheckpointInvalidPayload,
  AdvanceTerminalPayload,
  AvatarNotActivePayload,
  ConflictPayload,
  EmptyErrorPayload,
  MissingSessionPayload,
  SimVersionProblemPayload,
} from '../types';

export interface AdvanceActivityDeps {
  readonly db: Kysely<DB>;
  readonly keysServiceURL: string;
  readonly keyVersion: number;
  readonly loadContentDocument: (contentVersion: string) => Promise<ContentDocument | undefined>;
  readonly privateKey: CryptoKey;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
  readonly sendReplayWake: () => void;

  readonly simTimeCapMs: number;
}

export interface AdvanceActivityOpts {
  readonly context: {
    readonly actingSessionID: null | string;
    readonly actingUserID: null | string;
  };
  readonly errors: {
    readonly ACTIVITY_CAPPED: (payload: AdvanceBailPayload) => Error;
    readonly ACTIVITY_TERMINAL: (payload: AdvanceTerminalPayload) => Error;
    readonly AVATAR_NOT_ACTIVE: (payload: AvatarNotActivePayload) => Error;
    readonly CHAIN_QUARANTINED: (payload: AdvanceBailPayload) => Error;
    readonly CHECKPOINT_INVALID: (payload: AdvanceCheckpointInvalidPayload) => Error;
    readonly CONFLICT: (payload: ConflictPayload) => Error;
    readonly NODE_NOT_REVEALED: (payload: EmptyErrorPayload) => Error;
    readonly NODE_UNKNOWN: (payload: EmptyErrorPayload) => Error;
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly SESSION_EVICTED: (payload: AdvanceBailPayload) => Error;
    readonly SIM_VERSION_EXPIRED: (payload: SimVersionProblemPayload) => Error;
    readonly SIM_VERSION_UNKNOWN: (payload: SimVersionProblemPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: {
    readonly activityID: string;
    readonly continuations: ReadonlyArray<CatchUpContinuation>;
    readonly expectedHead: number;
    readonly activityStart?: OfflineActivityStartSubmission | undefined;
  };
}

export interface PinnedActivityContext {
  readonly avatarId: string;
  readonly contentVersion: string;
  readonly encounterNode: Readonly<EncounterNode>;
  readonly keyVersion: number;
  readonly scopeId: string;
  readonly scopeType: string;
  readonly secretRef: string;
  readonly secretVersion: number;
  readonly simVersion: string;
}

export interface MintedContinuation {
  readonly mintOutcome: 'converged' | 'minted';
  readonly row: Selectable<Activities>;
}

export type BailOutcome =
  | { readonly activityID: string; readonly appendedHead: number; readonly kind: 'capped' }
  | {
      readonly activityID: string;
      readonly appendedHead: number;
      readonly kind: 'chain-quarantined';
    }
  | {
      readonly activityID: string;
      readonly appendedHead: number;
      readonly avatarID: string;
      readonly kind: 'checkpoint-invalid';
      readonly reason: AdvanceCheckpointInvalidReason;
    }
  | {
      readonly activityID: string;
      readonly appendedHead: number;
      readonly avatarID: string;
      readonly kind: 'conflict';
      readonly reason: ConflictReason;
    }
  | { readonly activityID: string; readonly appendedHead: number; readonly kind: 'session-evicted' }
  | {
      readonly activityID: string;
      readonly appendedHead: number;
      readonly kind: 'terminal';
      readonly status: ActivityStatus;
    };

// The mint's insert trips one of two unique indexes: the primary key, when the client id already
// names a row, or the one-active-run-per-avatar index, when no row sits at that id.
export type MintCollisionResolution<TConverged> =
  | { readonly kind: 'converged'; readonly row: TConverged }
  | { readonly kind: 'refused'; readonly reason: 'active-run-exists' | 'activity-id-taken' };

export interface RunContinuationInput {
  readonly actingSessionID: null | string;
  readonly continuation: Readonly<CatchUpContinuation>;
  readonly targetActivityID: string;
  readonly targetExpectedHead: number;
}
