import type { DB } from '@vers/db';
import type { Transaction } from 'kysely';
import { recordRejection } from '../metrics/record-rejection';
import type { RejectionReason } from '../metrics/record-rejection';
import type { ReplayCache } from '../replay/create-replay-cache';
import type { CompareVerdict, ReplaySegment } from '../replay/types';
import { rejectActivity } from './reject-activity';
import type { ReplayIterationOutcome, ReplayWorkerDeps } from './types';

type RejectionCause =
  | 'confirmed-on-fresh-replay'
  | 'descriptor-validation-failed'
  | 'seed-validation-failed';

export async function rejectSegment(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
  divergence: Extract<CompareVerdict, { kind: 'divergence' }>,
  cause: RejectionCause,
): Promise<ReplayIterationOutcome> {
  deps.logger.error(
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      reason: divergence.reason,
      simVersion: segment.activity.simVersion,
      verifiedHead: segment.verifiedHead,
      version: divergence.version,
    },
    pickRejectMessage(cause),
  );

  const rejectionReason: RejectionReason =
    cause === 'descriptor-validation-failed' ? 'descriptor-mismatch' : 'integrity-mismatch';

  recordRejection(rejectionReason);

  await rejectActivity(trx, {
    activityID: segment.activity.id,
    avatarID: segment.activity.avatarID,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
  });

  cache.remove(segment.activity.id);

  return { kind: 'rejected' };
}

function pickRejectMessage(cause: RejectionCause): string {
  if (cause === 'seed-validation-failed') {
    return 'replay seed validation failed; rejecting activity';
  }

  if (cause === 'descriptor-validation-failed') {
    return 'replay descriptor validation failed; rejecting activity';
  }

  return 'replay divergence confirmed on a fresh replay; rejecting activity';
}
