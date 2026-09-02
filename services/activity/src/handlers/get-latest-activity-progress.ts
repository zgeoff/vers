import type { ActivityData, ActivityFailureAction, Checkpoint } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';
import { toActivityData } from './to-activity-data';
import { toCheckpointData } from './to-checkpoint-data';

interface GetLatestActivityProgressOpts {
  readonly context: {
    readonly actingSessionID: null | string;
    readonly actingUserID: null | string;
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

export async function getLatestActivityProgress(
  db: Kysely<DB>,
  opts: GetLatestActivityProgressOpts,
): Promise<GetLatestActivityProgressResult> {
  if (opts.context.actingUserID === null) {
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
    .where('avatars.userId', '=', opts.context.actingUserID)
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
    isWriter: row.writerSessionId === null || row.writerSessionId === opts.context.actingSessionID,
    serverTime: row.serverTime,
    verifiedHead: row.verifiedHead,
  };
}
