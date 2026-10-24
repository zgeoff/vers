import type { DB } from '@vers/db';
import type { Transaction } from 'kysely';
import { recordRejection } from '../metrics/record-rejection';
import type { ReplayCache } from '../replay/create-replay-cache';
import type { ReplaySegment } from '../replay/types';
import { rejectActivity } from './reject-activity';
import type { ReplayIterationOutcome, ReplayWorkerDeps } from './types';

export async function rejectUnreachableNode(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
): Promise<ReplayIterationOutcome> {
  deps.logger.error(
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      scopeID: segment.activity.scopeID,
      verifiedHead: segment.verifiedHead,
    },
    'replay node reachability check failed; rejecting activity',
  );

  recordRejection('node-unreachable');

  await rejectActivity(trx, {
    activityID: segment.activity.id,
    avatarID: segment.activity.avatarID,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
  });

  cache.remove(segment.activity.id);

  return { kind: 'rejected' };
}
