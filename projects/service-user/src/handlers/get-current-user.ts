import type { UserData } from '@vers/contract-user';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { MissingSessionPayload } from '../types';
import { toUserData } from './to-user-data';

/** oRPC handler opts for the authed `getCurrentUser` procedure. */
interface GetCurrentUserOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
}

/** Returns the acting user's own profile; UNAUTHORIZED both for no session and a deleted account. */
export async function getCurrentUser(db: Kysely<DB>, opts: GetCurrentUserOpts): Promise<UserData> {
  if (opts.context.actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const row = await db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', opts.context.actingUserId)
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  return toUserData(row);
}
