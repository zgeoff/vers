import type { UnauthorizedReason } from '@vers/contract-user';

/** Outcome of resolving the caller's session token: an authenticated user or the reason there isn't one. */
export type SessionResolution =
  | { userId: string }
  | { failure: UnauthorizedReason };

/** Per-request context available to every procedure handler. */
export interface ServiceContext {
  session: SessionResolution;
}
