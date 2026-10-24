import type { DB } from '@vers/db';
import type { Transaction } from 'kysely';
import { recordBackoff } from '../metrics/record-backoff';
import type { BackoffReason } from '../metrics/record-backoff';
import { updateReplayBackoff } from '../queue/update-replay-backoff';
import type { ReplayCache } from '../replay/create-replay-cache';
import type { ReplaySegment } from '../replay/types';
import type { ReplayIterationOutcome, ReplayWorkerDeps } from './types';

export async function scheduleReplayRetry(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
  reason: Extract<BackoffReason, 'keys-unavailable' | 'provider-unavailable'>,
): Promise<ReplayIterationOutcome> {
  const backoff = await updateReplayBackoff(trx, {
    activityID: segment.activity.id,
    verifiedHead: segment.verifiedHead,
  });

  deps.logger.warn(
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      reason,
      simVersion: segment.activity.simVersion,
      verifiedHead: segment.verifiedHead,
      ...backoff,
    },
    'replay dependency unavailable; backing the activity off',
  );

  recordBackoff(reason);

  cache.remove(segment.activity.id);

  return { kind: 'backedOff', reason };
}
