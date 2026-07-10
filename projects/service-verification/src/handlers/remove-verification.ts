import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload } from '../types';

/**
 * oRPC handler opts for the `deleteVerification` procedure.
 */
interface RemoveVerificationOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly id: string };
}

/**
 * Removes a verification record; throws NOT_FOUND when it doesn't exist.
 */
export async function removeVerification(
  db: Kysely<DB>,
  opts: RemoveVerificationOpts,
): Promise<{ deletedID: string }> {
  const row = await db
    .deleteFrom('verifications')
    .where('id', '=', opts.input.id)
    .returning('id as deletedId')
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return { deletedID: row.deletedId };
}
