import { recordBackoff } from '../metrics/record-backoff';
import type { BackoffReason } from '../metrics/record-backoff';
import { updateReplayBackoff } from '../queue/update-replay-backoff';
import type { ReplaySegment } from '../replay/types';
import type { ReplayIterationOutcome, ReplayTargetContext } from './types';

export async function scheduleReplayRetry(
  context: ReplayTargetContext,
  segment: Readonly<ReplaySegment>,
  reason: Extract<BackoffReason, 'keys-unavailable' | 'provider-unavailable'>,
): Promise<ReplayIterationOutcome> {
  const backoff = await updateReplayBackoff(context.trx, {
    activityID: segment.activity.id,
    verifiedHead: segment.verifiedHead,
  });

  context.deps.logger.warn(
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

  context.cache.remove(segment.activity.id);

  return { kind: 'backedOff', reason };
}
