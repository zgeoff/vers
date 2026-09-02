import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, FieldConflictPayload, MissingSessionPayload } from '../types';

/**
 * oRPC handler opts for the authed `updateEmail` procedure.
 */
interface UpdateEmailOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly CONFLICT: (payload: FieldConflictPayload<'email'>) => Error;
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly email: string };
}

/**
 * Changes the acting user's email, repointing any in-progress 2FA verification at the old email
 * to the new one in the same statement; throws CONFLICT when the email is taken. The users update
 * only applies while the row still holds the old email read just before it, and the verifications
 * repoint targets that same old email. In the exotic case of a concurrent email change racing this
 * one, the guarded update matches zero rows and the call retries once against the row's current
 * email before giving up.
 */
export async function updateEmail(
  db: Kysely<DB>,
  opts: UpdateEmailOpts,
): Promise<{ updatedID: string }> {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const user = await db
    .selectFrom('users')
    .select('email')
    .where('id', '=', actingUserID)
    .executeTakeFirst();

  if (user === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  try {
    const matched = await runGuardedEmailUpdate(db, actingUserID, user.email, opts.input.email);

    if (matched) {
      return { updatedID: actingUserID };
    }

    const retryUser = await db
      .selectFrom('users')
      .select('email')
      .where('id', '=', actingUserID)
      .executeTakeFirst();

    if (retryUser === undefined) {
      throw opts.errors.NOT_FOUND({ data: {} });
    }

    const retryMatched = await runGuardedEmailUpdate(
      db,
      actingUserID,
      retryUser.email,
      opts.input.email,
    );

    if (!retryMatched) {
      throw opts.errors.NOT_FOUND({ data: {} });
    }

    return { updatedID: actingUserID };
  } catch (error: unknown) {
    if (isEmailViolation(error)) {
      throw opts.errors.CONFLICT({ data: { field: 'email' } });
    }

    throw error;
  }
}

/**
 * Runs one guarded attempt of the users+verifications email rewrite in a single statement: the
 * users update is predicated on the row still holding `oldEmail`, and the verifications repoint
 * targets that same `oldEmail`. Returns whether the users predicate matched.
 */
async function runGuardedEmailUpdate(
  db: Kysely<DB>,
  actingUserID: string,
  oldEmail: string,
  newEmail: string,
): Promise<boolean> {
  const result = await db
    .with('updated', (qb) =>
      qb
        .updateTable('users')
        .set({ email: newEmail })
        .where('id', '=', actingUserID)
        .where('email', '=', oldEmail)
        .returning('id'),
    )
    .with('repointed', (qb) =>
      qb
        .updateTable('verifications')
        .set({ target: newEmail })
        .where('target', '=', oldEmail)
        .where('type', 'in', ['2fa', '2fa-setup'])
        .returning('id'),
    )
    .selectFrom('updated')
    .select('id')
    .execute();

  return result.length > 0;
}

/**
 * postgres.js surfaces a unique-constraint violation as SQLSTATE 23505, naming the constraint.
 */
function isEmailViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505' &&
    'constraint_name' in error &&
    (error as { constraint_name: unknown }).constraint_name === 'users_email_unique'
  );
}
