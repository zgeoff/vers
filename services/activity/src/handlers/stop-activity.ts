import type { ActivityData } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';
import { toActivityData } from './to-activity-data';

/**
 * oRPC handler opts for the authed `stopActivity` procedure.
 */
interface StopActivityOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly avatarID: string };
}

/**
 * Stops the active activity for an avatar owned by the acting user. The ownership check folds
 * into the same statement — a foreign or missing avatar matches no row, the same NOT_FOUND path
 * as an avatar with nothing active.
 */
export async function stopActivity(db: Kysely<DB>, opts: StopActivityOpts): Promise<ActivityData> {
  const actingUserID = opts.context.actingUserId;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const row = await db
    .updateTable('activities')
    .set({ status: 'stopped', stoppedAt: sql`now()` })
    .where('avatarId', '=', opts.input.avatarID)
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
