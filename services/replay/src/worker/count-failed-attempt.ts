import type { DB } from '@vers/db';
import type { Transaction } from 'kysely';
import { recordIterationFailure } from '../metrics/record-iteration-failure';
import { updateReplayAttempts } from '../queue/update-replay-attempts';
import type { ReplaySegment } from '../replay/types';
import type { ReplayIterationOutcome, ReplayWorkerDeps } from './types';

export async function countFailedAttempt(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  segment: Readonly<ReplaySegment>,
): Promise<ReplayIterationOutcome> {
  const result = await updateReplayAttempts(trx, {
    activityID: segment.activity.id,
  });

  if (result?.quarantined === true) {
    deps.logger.error(
      { activityID: segment.activity.id },
      'replay attempts exhausted; activity quarantined',
    );

    recordIterationFailure('quarantined');

    return { kind: 'quarantined' };
  }

  return { kind: 'unconfirmedDivergence' };
}
