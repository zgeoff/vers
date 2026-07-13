import type { ActivityData } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';
import { toActivityData } from './to-activity-data';

/**
 * oRPC handler opts for the authed `resumeActivity` procedure.
 */
interface ResumeActivityOpts {
  readonly context: {
    readonly actingSessionId: null | string;
    readonly actingUserId: null | string;
  };
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly activityID: string };
}

/**
 * Takes over as an active activity's writer session: after this call the acting session is the
 * only one whose appends pass the writer fence, and the displaced writer's in-flight submissions
 * fail fatally. Taking the writer is the whole of resuming server-side — the caller rebuilds its
 * simulation from the verified anchor and appends from the current head. The ownership check
 * folds into the same statement, so a foreign or missing activity is the same NOT_FOUND as a
 * terminal one.
 */
export async function resumeActivity(
  db: Kysely<DB>,
  opts: ResumeActivityOpts,
): Promise<ActivityData> {
  const actingUserID = opts.context.actingUserId;
  const actingSessionID = opts.context.actingSessionId;

  if (actingUserID === null || actingSessionID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const row = await db
    .updateTable('activities')
    .set({ writerSessionId: actingSessionID })
    .where('id', '=', opts.input.activityID)
    .where('status', '=', 'active')
    .where('avatarId', 'in', (subquery) =>
      subquery.selectFrom('avatars').select('id').where('userId', '=', actingUserID),
    )
    .returningAll()
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return toActivityData(row);
}
