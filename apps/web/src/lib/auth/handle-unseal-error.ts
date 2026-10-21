import type { UnsealErrorReason } from 'iron-session';
import { logger } from '../../server/logger';

export function handleUnsealError(reason: UnsealErrorReason, error: unknown): void {
  if (reason === 'expired') {
    return;
  }

  logger.warn({ err: error, reason }, 'session cookie rejected');
}
