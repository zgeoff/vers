import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, FieldConflictPayload, MissingSessionPayload } from '../types';

interface UpdateUserOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly CONFLICT: (payload: FieldConflictPayload<'username'>) => Error;
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly name?: string | undefined; readonly username?: string | undefined };
}

export async function updateUser(
  db: Kysely<DB>,
  opts: UpdateUserOpts,
): Promise<{ updatedID: string }> {
  if (opts.context.actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  // every updatable field is optional, so an empty update must not reach the query builder —
  // an UPDATE with no SET clause is invalid SQL
  if (opts.input.name === undefined && opts.input.username === undefined) {
    const existing = await db
      .selectFrom('users')
      .select('id')
      .where('id', '=', opts.context.actingUserID)
      .executeTakeFirst();

    if (existing === undefined) {
      throw opts.errors.NOT_FOUND({ data: {} });
    }

    return { updatedID: existing.id };
  }

  try {
    const row = await db
      .updateTable('users')
      .set({
        ...(opts.input.name !== undefined && { name: opts.input.name }),
        ...(opts.input.username !== undefined && { username: opts.input.username }),
      })
      .where('id', '=', opts.context.actingUserID)
      .returning('id as updatedId')
      .executeTakeFirst();

    if (row === undefined) {
      throw opts.errors.NOT_FOUND({ data: {} });
    }

    return { updatedID: row.updatedId };
  } catch (error: unknown) {
    if (isUsernameViolation(error)) {
      throw opts.errors.CONFLICT({ data: { field: 'username' } });
    }

    throw error;
  }
}

function isUsernameViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505' &&
    'constraint_name' in error &&
    (error as { constraint_name: unknown }).constraint_name === 'users_username_unique'
  );
}
