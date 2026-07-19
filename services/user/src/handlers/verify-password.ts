import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

// a fixed, valid argon2id hash verified against on every miss so a missing user or unset
// password takes the same time as a real check — never revealing which case occurred
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=2,p=1$HcnWDKgn0Ge+fMLfUNLxdQyZQP62cm11r4tp2hS9GwE$jcksXM4djDmS+FjzQVmKOHr/5+J1lvSh1lPjUesXBco';

/**
 * oRPC handler opts for the `verifyPassword` procedure.
 */
interface VerifyPasswordOpts {
  readonly input: { readonly email: string; readonly password: string };
}

/**
 * Checks a password against a user's stored hash; never throws for wrong credentials or an
 * unknown email, and rehashes a successfully verified legacy bcrypt hash to argon2id.
 */
export async function verifyPassword(
  db: Kysely<DB>,
  opts: VerifyPasswordOpts,
): Promise<{ success: boolean }> {
  const row = await db
    .selectFrom('users')
    .selectAll()
    .where('email', '=', opts.input.email)
    .executeTakeFirst();

  if (row === undefined || row.passwordHash === null) {
    await Bun.password.verify(opts.input.password, DUMMY_HASH);

    return { success: false };
  }

  if (row.passwordHash.startsWith('$2')) {
    const isValid = await Bun.password.verify(opts.input.password, row.passwordHash);

    if (!isValid) {
      return { success: false };
    }

    const passwordHash = await Bun.password.hash(opts.input.password, 'argon2id');

    await db.updateTable('users').set({ passwordHash }).where('id', '=', row.id).execute();

    return { success: true };
  }

  const isValid = await Bun.password.verify(opts.input.password, row.passwordHash);

  return { success: isValid };
}
