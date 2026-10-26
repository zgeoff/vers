import { parkActivity } from '../dispatch/park-activity';
import { recordRejection } from '../metrics/record-rejection';
import type { RejectionReason } from '../metrics/record-rejection';
import type { ReplaySegment } from '../replay/types';
import type { ParkReason, ReplayIterationOutcome, ReplayTargetContext } from './types';

export async function parkReplayTarget(
  context: ReplayTargetContext,
  segment: Readonly<ReplaySegment>,
  reason: ParkReason,
): Promise<ReplayIterationOutcome> {
  recordRejection(pickParkRejectionReason(reason));

  await parkActivity(context.trx, segment.activity.id);

  context.cache.remove(segment.activity.id);

  return {
    kind: 'parked',
    parked: {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      appendedTimeMs: segment.activity.appendedTimeMs,
      simVersion: segment.activity.simVersion,
      verifiedHead: segment.verifiedHead,
    },
    reason,
  };
}

function pickParkRejectionReason(reason: ParkReason): RejectionReason {
  return reason === 'durationCapExceeded' ? 'elapsed-time' : 'version-park';
}
