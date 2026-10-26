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
  const message = pickParkMessage(reason);

  context.deps.logger.warn(message, {
    activityID: segment.activity.id,
    appendedHead: segment.activity.appendedHead,
    appendedTimeMs: segment.activity.appendedTimeMs,
    checkpointCount: segment.activity.appendedHead,
    reason,
    simVersion: segment.activity.simVersion,
    verifiedHead: segment.verifiedHead,
  });

  recordRejection(pickParkRejectionReason(reason));

  await parkActivity(context.trx, segment.activity.id);

  context.cache.remove(segment.activity.id);

  return { kind: 'parked', reason };
}

// The infra program's replay-parked alarm matches 'parking activity' in each line, so a message that
// drops the phrase parks the activity without alarming anyone.
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
