import type { DB } from '@vers/db';
import type { Transaction } from 'kysely';
import { parkActivity } from '../dispatch/park-activity';
import { recordRejection } from '../metrics/record-rejection';
import type { RejectionReason } from '../metrics/record-rejection';
import type { ReplayCache } from '../replay/create-replay-cache';
import type { ReplaySegment } from '../replay/types';
import type { ParkReason, ReplayIterationOutcome, ReplayWorkerDeps } from './types';

export async function parkReplayTarget(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
  reason: ParkReason,
): Promise<ReplayIterationOutcome> {
  const message = pickParkMessage(reason);

  deps.logger.warn(
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      appendedTimeMs: segment.activity.appendedTimeMs,
      checkpointCount: segment.activity.appendedHead,
      reason,
      simVersion: segment.activity.simVersion,
      verifiedHead: segment.verifiedHead,
    },
    message,
  );

  recordRejection(pickParkRejectionReason(reason));

  await parkActivity(trx, segment.activity.id);

  cache.remove(segment.activity.id);

  return { kind: 'parked', reason };
}

function pickParkMessage(reason: ParkReason): string {
  if (reason === 'expired') {
    return 'sim version retention expired; parking activity for operator resolution';
  }

  if (reason === 'unknownVersion') {
    return 'sim version unrecognized; parking activity';
  }

  return 'replay duration cap exhausted before the expected checkpoint count; parking activity for operator resolution';
}

function pickParkRejectionReason(reason: ParkReason): RejectionReason {
  return reason === 'durationCapExceeded' ? 'elapsed-time' : 'version-park';
}
