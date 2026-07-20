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
  readonly context: {
    readonly actingSessionId: null | string;
    readonly actingUserId: null | string;
  };
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly SESSION_EVICTED: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly activityID?: string | undefined; readonly avatarID: string };
}

/**
 * Stops an activity for an avatar owned by the acting user, then advances the chain's appended
 * anchor to the stopped stream's tail. Without `activityID` the call stops whatever is active —
 * `NOT_FOUND` when nothing is. With `activityID` the call is targeted and idempotent: only that
 * row is ever touched, a row that already left `active` succeeds with the row as-is, and
 * `NOT_FOUND` means the row doesn't exist for this caller — so a stop delivered late or twice
 * from a durable client queue can neither fail spuriously nor kill a newer run. A still-active
 * row whose stamped writer is another session rejects with SESSION_EVICTED: the stop intent
 * predates a writer take-over, and honoring it would kill the run the new writer is driving. The
 * ownership check folds into each statement — a foreign or missing avatar matches no row.
 */
export async function stopActivity(db: Kysely<DB>, opts: StopActivityOpts): Promise<ActivityData> {
  const actingUserID = opts.context.actingUserId;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const actingSessionID = opts.context.actingSessionId;

  const row = await db.transaction().execute(async (trx) => {
    // A lockless read to learn which chain the activity belongs to; the guarded update below
    // re-verifies everything it found. Writers that touch both rows acquire the chain row before
    // the activity row, so the chain lock comes first.
    const baseQuery = trx
      .selectFrom('activities')
      .selectAll()
      .where('avatarId', '=', opts.input.avatarID)
      .where('avatarId', 'in', (subquery) =>
        subquery.selectFrom('avatars').select('id').where('userId', '=', actingUserID),
      );

    const found = await (
      opts.input.activityID === undefined
        ? baseQuery.where('status', '=', 'active')
        : baseQuery.where('id', '=', opts.input.activityID)
    ).executeTakeFirst();

    if (found === undefined) {
      throw opts.errors.NOT_FOUND({ data: {} });
    }

    if (found.status !== 'active') {
      return found;
    }

    if (found.writerSessionId !== null && found.writerSessionId !== actingSessionID) {
      throw opts.errors.SESSION_EVICTED({ data: {} });
    }

    await trx
      .selectFrom('activityChains')
      .select('appendedChainIndex')
      .where('avatarId', '=', opts.input.avatarID)
      .where('scopeType', '=', found.scopeType)
      .where('scopeId', '=', found.scopeId)
      .forUpdate()
      .execute();

    const stopped = await trx
      .updateTable('activities')
      .set({ status: 'stopped', stoppedAt: sql`now()` })
      .where('id', '=', found.id)
      .where('status', '=', 'active')
      .where((eb) =>
        eb.or([eb('writerSessionId', 'is', null), eb('writerSessionId', '=', actingSessionID)]),
      )
      .where('avatarId', 'in', (subquery) =>
        subquery.selectFrom('avatars').select('id').where('userId', '=', actingUserID),
      )
      .returningAll()
      .executeTakeFirst();

    // The row moved between the read and the guarded update: it left `active` (a terminal append
    // or a concurrent stop won the race) or its writer was taken over. A targeted call is already
    // satisfied by a settled row, so it is re-read and returned; a row still active under another
    // writer rejects instead — the take-over supersedes this stop; the untargeted form keeps its
    // original meaning and reports nothing active.
    if (stopped === undefined) {
      if (opts.input.activityID === undefined) {
        throw opts.errors.NOT_FOUND({ data: {} });
      }

      const settled = await trx
        .selectFrom('activities')
        .selectAll()
        .where('id', '=', found.id)
        .executeTakeFirst();

      if (settled === undefined) {
        throw opts.errors.NOT_FOUND({ data: {} });
      }

      if (settled.status === 'active') {
        throw opts.errors.SESSION_EVICTED({ data: {} });
      }

      return settled;
    }

    await updateAppendedAnchorFromTail(trx, {
      activityId: stopped.id,
      appendedHead: stopped.appendedHead,
      avatarId: stopped.avatarId,
      scopeId: stopped.scopeId,
      scopeType: stopped.scopeType,
      startChainIndex: stopped.startChainIndex,
    });

    return stopped;
  });

  return toActivityData(row);
}
