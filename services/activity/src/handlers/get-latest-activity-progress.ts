import type { ActivityData, Checkpoint } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';
import { toActivityData } from './to-activity-data';
import { toCheckpointData } from './to-checkpoint-data';

/**
 * oRPC handler opts for the authed `getLatestActivityProgress` procedure.
 */
interface GetLatestActivityProgressOpts {
  readonly context: { readonly actingUserId: null | string };
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
  readonly verifiedHead: number;
}

/**
 * Returns an avatar's most recent activity (regardless of status) with its resume cursors, and
 * the checkpoint the client resumes from — null while `verifiedHead` is still 0, since the client
 * then resumes from the start record instead.
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
    verifiedHead: row.verifiedHead,
  };
}
