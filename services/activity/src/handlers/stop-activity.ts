import type { ActivityData } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';
import { toActivityData } from './to-activity-data';
import { updateAppendedAnchorFromTail } from './update-appended-anchor-from-tail';

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
 * Stops the active activity for an avatar owned by the acting user, then advances the chain's
 * appended anchor to the stopped stream's tail. The ownership check folds into the same statement
 * — a foreign or missing avatar matches no row, the same NOT_FOUND path as an avatar with nothing
 * active.
 */
export async function stopActivity(db: Kysely<DB>, opts: StopActivityOpts): Promise<ActivityData> {
  const actingUserID = opts.context.actingUserId;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const row = await db.transaction().execute(async (trx) => {
    const stopped = await trx
      .updateTable('activities')
      .set({ status: 'stopped', stoppedAt: sql`now()` })
      .where('avatarId', '=', opts.input.avatarID)
      .where('status', '=', 'active')
      .where('avatarId', 'in', (subquery) =>
        subquery.selectFrom('avatars').select('id').where('userId', '=', actingUserID),
      )
      .returningAll()
      .executeTakeFirst();

    if (stopped === undefined) {
      throw opts.errors.NOT_FOUND({ data: {} });
    }

    await updateAppendedAnchorFromTail(trx, {
      activityId: stopped.id,
      appendedHead: stopped.appendedHead,
      avatarId: stopped.avatarId,
      lastHash: stopped.lastHash,
      scopeId: stopped.scopeId,
      scopeType: stopped.scopeType,
      startChainIndex: stopped.startChainIndex,
    });

    return stopped;
  });

  return toActivityData(row);
}
