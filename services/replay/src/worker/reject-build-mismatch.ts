import { recordRejection } from '../metrics/record-rejection';
import type { ReplaySegment } from '../replay/types';
import { rejectActivity } from './reject-activity';
import type { ReplayIterationOutcome, ReplayTargetContext } from './types';

export async function rejectBuildMismatch(
  context: ReplayTargetContext,
  segment: Readonly<ReplaySegment>,
): Promise<ReplayIterationOutcome> {
  context.deps.logger.error(
    'pinned build does not match the settled xp total; rejecting activity',
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      buildSnapshotXP: segment.activity.buildSnapshot.xp,
      verifiedHead: segment.verifiedHead,
    },
  );

  recordRejection('build-mismatch');

  await rejectActivity(context.trx, {
    activityID: segment.activity.id,
    avatarID: segment.activity.avatarID,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
  });

  context.cache.remove(segment.activity.id);

  return { kind: 'rejected' };
}
