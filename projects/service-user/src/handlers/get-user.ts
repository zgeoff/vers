import type { UserData } from '@vers/contract-user';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { toUserData } from './to-user-data';

/** oRPC handler opts for the `getUser` procedure. */
interface GetUserOpts {
  readonly input: { readonly email?: string | undefined; readonly id?: string | undefined };
}

/** Looks up a user matching the provided id or email; null when neither is provided or matches. */
export async function getUser(db: Kysely<DB>, opts: GetUserOpts): Promise<UserData | null> {
  const row = await db
    .selectFrom('users')
    .selectAll()
    .where((eb) => {
      const conditions = [];

      if (opts.input.email !== undefined) {
        conditions.push(eb('email', '=', opts.input.email));
      }

      if (opts.input.id !== undefined) {
        conditions.push(eb('id', '=', opts.input.id));
      }

      return eb.or(conditions);
    })
    .executeTakeFirst();

  return row === undefined ? null : toUserData(row);
}
