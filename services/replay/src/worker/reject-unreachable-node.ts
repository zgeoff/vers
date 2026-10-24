import { recordRejection } from '../metrics/record-rejection';
import type { ReplaySegment } from '../replay/types';
import { rejectActivity } from './reject-activity';
import type { ReplayIterationOutcome, ReplayTargetContext } from './types';

export async function rejectUnreachableNode(
  context: ReplayTargetContext,
  segment: Readonly<ReplaySegment>,
): Promise<ReplayIterationOutcome> {
  context.deps.logger.error(
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      scopeID: segment.activity.scopeID,
      verifiedHead: segment.verifiedHead,
    },
    'replay node reachability check failed; rejecting activity',
  );

  recordRejection('node-unreachable');

  await rejectActivity(context.trx, {
    activityID: segment.activity.id,
    avatarID: segment.activity.avatarID,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
  });

  context.cache.remove(segment.activity.id);

  return { kind: 'rejected' };
}
