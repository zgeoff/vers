import type { ActivityData } from '@vers/contract-activity';

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
