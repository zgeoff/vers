import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, FieldConflictPayload, MissingSessionPayload } from '../types';

/** oRPC handler opts for the authed `updateEmail` procedure. */
interface UpdateEmailOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly CONFLICT: (payload: FieldConflictPayload<'email'>) => Error;
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly email: string };
}

/**
 * Changes the acting user's email, repointing any in-progress 2FA verification at the old email
 * to the new one in the same statement; throws CONFLICT when the email is taken.
 */
export async function updateEmail(
  db: Kysely<DB>,
  opts: UpdateEmailOpts,
): Promise<{ updatedID: string }> {
  const { actingUserId } = opts.context;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const user = await db
    .selectFrom('users')
    .select('email')
    .where('id', '=', actingUserId)
    .executeTakeFirst();

  if (user === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  try {
    await db
      .with('updated', (qb) =>
        qb
          .updateTable('users')
          .set({ email: opts.input.email })
          .where('id', '=', actingUserId)
          .returningAll(),
      )
      .updateTable('verifications')
      .set({ target: opts.input.email })
      .where('target', '=', user.email)
      .where('type', 'in', ['2fa', '2fa-setup'])
      .execute();

    return { updatedID: actingUserId };
  } catch (error: unknown) {
    if (isEmailViolation(error)) {
      throw opts.errors.CONFLICT({ data: { field: 'email' } });
    }

    throw error;
  }
}

/** postgres.js surfaces a unique-constraint violation as SQLSTATE 23505, naming the constraint. */
function isEmailViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23505' &&
    'constraint_name' in error &&
    (error as { constraint_name: unknown }).constraint_name === 'users_email_unique'
  );
}
