import type { ActivityData } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { recordWriterTakeover } from '../metrics/record-writer-takeover';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';
import { toActivityData } from './to-activity-data';

/**
 * oRPC handler opts for the authed `resumeActivity` procedure.
 */
interface ResumeActivityOpts {
  readonly context: {
    readonly actingSessionID: null | string;
    readonly actingUserID: null | string;
  };
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly activityID: string };
}

/**
 * Takes over as an active activity's writer session: after this call the acting session is the
 * only one whose appends are accepted, and the displaced writer's in-flight submissions
 * fail fatally. Taking the writer is the whole of resuming server-side — the caller rebuilds its
 * simulation from the verified anchor and appends from the current head. A foreign, missing, or
 * terminal activity all fail the same NOT_FOUND.
 */
export async function resumeActivity(
  db: Kysely<DB>,
  opts: ResumeActivityOpts,
): Promise<ActivityData> {
  const actingUserID = opts.context.actingUserID;
  const actingSessionID = opts.context.actingSessionID;

  if (actingUserID === null || actingSessionID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const row = await db
    .updateTable('activities')
    .set({ writerSessionId: actingSessionID })
    .where('id', '=', opts.input.activityID)
    .where('status', '=', 'active')

    // the ownership check folds into this statement, so a foreign activity fails the same
    // NOT_FOUND path as a missing or terminal one
    .where('avatarId', 'in', (subquery) =>
      subquery.selectFrom('avatars').select('id').where('userId', '=', actingUserID),
    )
    .returningAll()
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  recordWriterTakeover();

  return toActivityData(row);
}
