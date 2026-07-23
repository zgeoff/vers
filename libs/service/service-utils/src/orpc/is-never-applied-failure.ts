import { ORPCError } from '@orpc/client';
import type { OutboundFailureMode } from './types';

/**
 * Reports whether `error` is a bounded-fetch `SERVICE_UNAVAILABLE` tagged with the `'transport'`
 * failure mode — the outbound request never reached the server, so nothing applied and retrying is
 * safe regardless of the procedure's HTTP method.
 */
export function isNeverAppliedFailure(error: unknown): boolean {
  if (!(error instanceof ORPCError)) {
    return false;
  }

  const data: unknown = error.data;

  return isServiceUnavailableErrorData(data) && data.failureMode === 'transport';
}

interface ServiceUnavailableErrorData {
  readonly failureMode?: OutboundFailureMode;
}

function isServiceUnavailableErrorData(value: unknown): value is ServiceUnavailableErrorData {
  return typeof value === 'object' && value !== null;
}
