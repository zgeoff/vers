import type { RetryTimings } from './types';

export function buildRetryBackoffMS(retryTimings: Readonly<RetryTimings>, attempt: number): number {
  return Math.min(retryTimings.minTimeout * 2 ** attempt, retryTimings.maxTimeout);
}
