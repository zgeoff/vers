import type { ActivityData } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { MissingSessionPayload } from '../types';
import { toActivityData } from './to-activity-data';

/**
 * oRPC handler opts for the authed `getCurrentActivity` procedure.
 */
interface GetCurrentActivityOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly avatarID: string };
}

/**
 * Returns the active activity for an avatar owned by the acting user, or null when there is none
 * or the avatar isn't theirs.
 */
export async function getCurrentActivity(
  db: Kysely<DB>,
  opts: GetCurrentActivityOpts,
): Promise<ActivityData | null> {
  if (opts.context.actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const row = await db
    .selectFrom('activities')
    .innerJoin('avatars', 'avatars.id', 'activities.avatarId')
    .selectAll('activities')
    .where('activities.avatarId', '=', opts.input.avatarID)
    .where('avatars.userId', '=', opts.context.actingUserID)
    .where('activities.status', '=', 'active')
    .executeTakeFirst();

  return row === undefined ? null : toActivityData(row);
}
