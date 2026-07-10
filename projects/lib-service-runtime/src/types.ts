import type pino from 'pino';

/**
 * Per-request context available to every procedure handler.
 */
export interface ServiceContext {
  /**
   * Acting user named by the verified service token; null for verified anonymous calls.
   */
  actingUserId: null | string;
  logger: pino.Logger;
  requestId: string;
}
