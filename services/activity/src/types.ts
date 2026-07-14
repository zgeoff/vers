import type { ActivityData, ActivityStatus } from '@vers/contract-activity';

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
 * Payload shape for `startActivity`'s CONFLICT: the avatar's already-active activity.
 */
export interface ActiveActivityConflictPayload {
  readonly data: { readonly activity: ActivityData };
}

/**
 * Payload shape for `startActivity`'s SIM_VERSION_UNKNOWN and SIM_VERSION_EXPIRED: the registry's
 * current engine hash, null when the registry carries no active version, so the client knows what
 * to resync onto.
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
  readonly data: { readonly reason: string };
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
