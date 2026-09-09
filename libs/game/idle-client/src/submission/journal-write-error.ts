import type { JournalFailureKind } from '../types';

// the browser reports an exhausted origin quota as a DOMException named QuotaExceededError on the
// request, which idb rethrows as the put's rejection
const QUOTA_ERROR_NAME = 'QuotaExceededError';

export class JournalWriteError extends Error {
  readonly activityID: string;

  readonly kind: Extract<JournalFailureKind, 'quota' | 'write'>;

  constructor(activityID: string, cause: unknown) {
    const kind =
      cause instanceof Error && cause.name === QUOTA_ERROR_NAME
        ? ('quota' as const)
        : ('write' as const);

    super(`journal write failed for activity ${activityID}: ${kind}`, { cause });

    this.name = 'JournalWriteError';
    this.activityID = activityID;
    this.kind = kind;
  }
}
