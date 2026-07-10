import type { VerificationType } from '@vers/contract-verification';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload } from '../types';

/**
 * oRPC handler opts for the `updateVerification` procedure.
 */
interface UpdateVerificationOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly id: string; readonly type?: VerificationType | undefined };
}

/**
 * Updates a verification record's set fields; throws NOT_FOUND when it doesn't exist.
 */
export async function updateVerification(
  db: Kysely<DB>,
  opts: UpdateVerificationOpts,
): Promise<{ updatedID: string }> {
  // every updatable field is optional, so an empty update must not reach the query builder —
  // an UPDATE with no SET clause is invalid SQL
  if (opts.input.type === undefined) {
    const existing = await db
      .selectFrom('verifications')
      .select('id')
      .where('id', '=', opts.input.id)
      .executeTakeFirst();

    if (existing === undefined) {
      throw opts.errors.NOT_FOUND({ data: {} });
    }

    return { updatedID: existing.id };
  }

  const row = await db
    .updateTable('verifications')
    .set({ type: opts.input.type })
    .where('id', '=', opts.input.id)
    .returning('id as updatedId')
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return { updatedID: row.updatedId };
}
