import type { DB } from '@vers/db';
import type { Transaction } from 'kysely';
import { recordIterationFailure } from '../metrics/record-iteration-failure';
import { updateReplayAttempts } from '../queue/update-replay-attempts';
import type { ReplaySegment } from '../replay/types';
import type { ReplayIterationOutcome } from './types';

export async function countFailedAttempt(
  trx: Transaction<DB>,
  segment: Readonly<ReplaySegment>,
): Promise<ReplayIterationOutcome> {
  const result = await updateReplayAttempts(trx, {
    activityID: segment.activity.id,
  });

  if (result?.quarantined === true) {
    recordIterationFailure('quarantined');

    return { activityID: segment.activity.id, kind: 'quarantined' };
  }

  return { kind: 'unconfirmedDivergence' };
}
