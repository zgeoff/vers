import type { ActivityData } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';
import { toActivityData } from './to-activity-data';
import { updateAppendedAnchorFromTail } from './update-appended-anchor-from-tail';

interface StopActivityDeps {
  readonly db: Kysely<DB>;
  readonly sendReplayWake: () => void;
}

interface StopActivityOpts {
  readonly context: {
    readonly actingSessionID: null | string;
    readonly actingUserID: null | string;
  };
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly SESSION_EVICTED: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly activityID?: string | undefined; readonly avatarID: string };
}

export async function stopActivity(
  deps: StopActivityDeps,
  opts: StopActivityOpts,
): Promise<ActivityData> {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const actingSessionID = opts.context.actingSessionID;

  const outcome = await deps.db.transaction().execute(async (trx) => {
    // A lockless read to learn which chain the activity belongs to; the guarded update below
    // re-verifies everything it found. Writers that touch both rows acquire the chain row before
    // the activity row, so the chain lock comes first.
    const baseQuery = trx
      .selectFrom('activities')
      .selectAll()
      .where('avatarId', '=', opts.input.avatarID)

      // Folds the ownership check into the query: a foreign or missing avatar matches no row.
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
      return { kind: 'idempotent', row: found } as const;
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

    // the row moved between the read and the guarded update: it left `active` or its writer was
    // taken over. a targeted call is already satisfied by a settled row and re-reads it; a row
    // still active under another writer rejects, since the take-over supersedes this stop
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

      return { kind: 'idempotent', row: settled } as const;
    }

    await updateAppendedAnchorFromTail(trx, {
      activityId: stopped.id,
      appendedHead: stopped.appendedHead,
      avatarId: stopped.avatarId,
      scopeId: stopped.scopeId,
      scopeType: stopped.scopeType,
      startChainIndex: stopped.startChainIndex,
    });

    return { kind: 'stopped', row: stopped } as const;
  });

  if (outcome.kind === 'stopped') {
    deps.sendReplayWake();
  }

  return toActivityData(outcome.row);
}
