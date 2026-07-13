import type pino from 'pino';

/**
 * Per-request context available to every procedure handler.
 */
export interface ServiceContext {
  /**
   * Session named by the verified service token's `sid` claim — compared against an activity's
   * stamped writer before an append is accepted; null when the call holds no live session.
   */
  actingSessionId: null | string;

  /**
   * Acting user named by the verified service token; null for verified anonymous calls.
   */
  actingUserId: null | string;
  logger: pino.Logger;

  /**
   * W3C trace id shared with the caller; also stamped on logs and the `x-trace-id` response
   * header.
   */
  traceID: string;
}
