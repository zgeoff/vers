import type { ActivityData, ActivityFailureAction, Checkpoint } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';
import { toActivityData } from './to-activity-data';
import { toCheckpointData } from './to-checkpoint-data';

/**
 * oRPC handler opts for the authed `getLatestActivityProgress` procedure.
 */
interface GetLatestActivityProgressOpts {
  readonly context: {
    readonly actingSessionId: null | string;
    readonly actingUserId: null | string;
  };
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly avatarID: string };
}

interface GetLatestActivityProgressResult {
  readonly activity: ActivityData;
  readonly anchor: Checkpoint | null;
  readonly appendedHead: number;
  readonly failureAction: ActivityFailureAction;
  readonly isWriter: boolean;
  readonly serverTime: Date;
  readonly verifiedHead: number;
}

/**
 * Returns an avatar's most recent activity (regardless of status) with its resume cursors, the
 * checkpoint the client resumes from — null while `verifiedHead` is still 0, since the client
 * then resumes from the start record instead — and the database's current time, read in the same
 * query as the row so the client computes its offline gap against the clock that meters it.
 * `isWriter` reports whether the calling session may append: it matches the stamped writer, or no
 * writer is stamped yet.
 */
export async function getLatestActivityProgress(
  db: Kysely<DB>,
  opts: GetLatestActivityProgressOpts,
): Promise<GetLatestActivityProgressResult> {
  if (opts.context.actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const row = await db
    .selectFrom('activities')
    .innerJoin('avatars', 'avatars.id', 'activities.avatarId')
    .selectAll('activities')
    .select('avatars.failureAction')

    // Cast to the row's timestamp column type so the driver parses the clock and the activity's
    // timestamps identically regardless of session timezone — clients subtract the two.
    .select(sql<Date>`now()::timestamp`.as('serverTime'))
    .where('activities.avatarId', '=', opts.input.avatarID)
    .where('avatars.userId', '=', opts.context.actingUserId)
    .orderBy('activities.startedAt', 'desc')
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const anchor =
    row.verifiedHead === 0
      ? undefined
      : await db
          .selectFrom('activityCheckpoints')
          .selectAll()
          .where('activityId', '=', row.id)
          .where('version', '=', row.verifiedHead)
          .executeTakeFirst();

  return {
    activity: toActivityData(row),
    anchor: anchor === undefined ? null : toCheckpointData(anchor),
    appendedHead: row.appendedHead,
    failureAction: row.failureAction,
    isWriter: row.writerSessionId === null || row.writerSessionId === opts.context.actingSessionId,
    serverTime: row.serverTime,
    verifiedHead: row.verifiedHead,
  };
}
