import type {
  ActivityStatus,
  AdvanceCheckpointInvalidReason,
  CheckpointInvalidReason,
} from '@vers/contract-activity';

/**
 * Payload shape for an authed procedure's UNAUTHORIZED error when no acting user is present.
 */
export interface MissingSessionPayload {
  readonly data: { readonly reason: 'missing-session' };
}

/**
 * Payload shape for a data-less contract error (NOT_FOUND).
 */
export interface EmptyErrorPayload {
  readonly data: Record<never, never>;
}

/**
 * Payload shape for AVATAR_NOT_ACTIVE: the account's actual active avatar, so the caller can name
 * who it is without a second round-trip.
 */
export interface AvatarNotActivePayload {
  readonly data: { readonly activeAvatarID: string; readonly activeAvatarName: string };
}

/**
 * Payload shape for SIM_VERSION_UNKNOWN and SIM_VERSION_EXPIRED: the registry's current engine
 * hash, null when the registry carries no active version, so the client knows what to resync onto.
 */
export interface SimVersionProblemPayload {
  readonly data: { readonly currentSimVersion: string | null };
}

/**
 * Payload shape for `trackActivityProgress`'s CONFLICT: the activity's current appended head, so
 * the caller can resend its tail from there.
 */
export interface StaleHeadPayload {
  readonly data: { readonly appendedHead: number };
}

/**
 * Payload shape for `trackActivityProgress`'s CHECKPOINT_INVALID.
 */
export interface CheckpointInvalidPayload {
  readonly data: { readonly reason: CheckpointInvalidReason };
}

/**
 * Payload shape for `trackActivityProgress`'s ACTIVITY_TERMINAL: the terminal status that rejects
 * the append, plus the stream's final head so the caller can rebase without a refetch.
 */
export interface TerminalStatusPayload {
  readonly data: { readonly appendedHead: number; readonly status: ActivityStatus };
}

/**
 * Payload shape for `trackActivityProgress`'s ACTIVITY_CAPPED: the head the stream stopped at —
 * the exact index the caller rebases its chain cursor from after a resync.
 */
export interface CappedPayload {
  readonly data: { readonly appendedHead: number };
}

/**
 * Payload shape for `advanceActivity`'s bail errors — CONFLICT, ACTIVITY_CAPPED,
 * CHAIN_QUARANTINED, SESSION_EVICTED: the last row the bulk request fully committed, whatever
 * reason stopped it, so the caller re-plans from it without a refetch.
 */
export interface AdvanceBailPayload {
  readonly data: { readonly activityID: string; readonly appendedHead: number };
}

/**
 * Payload shape for `advanceActivity`'s CHECKPOINT_INVALID: the last fully committed row, plus
 * the structural or cross-check reason a continuation's tail failed.
 */
export interface AdvanceCheckpointInvalidPayload {
  readonly data: {
    readonly activityID: string;
    readonly appendedHead: number;
    readonly reason: AdvanceCheckpointInvalidReason;
  };
}

/**
 * Payload shape for `advanceActivity`'s ACTIVITY_TERMINAL: the last fully committed row, plus
 * the terminal status a continuation's target had already reached.
 */
export interface AdvanceTerminalPayload {
  readonly data: {
    readonly activityID: string;
    readonly appendedHead: number;
    readonly status: ActivityStatus;
  };
}
