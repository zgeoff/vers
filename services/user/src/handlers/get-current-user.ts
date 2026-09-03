import type { UserData } from '@vers/contract-user';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { MissingSessionPayload } from '../types';
import { toUserData } from './to-user-data';

interface GetCurrentUserOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
}

export async function getCurrentUser(db: Kysely<DB>, opts: GetCurrentUserOpts): Promise<UserData> {
  if (opts.context.actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const row = await db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', opts.context.actingUserID)
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  return toUserData(row);
}
