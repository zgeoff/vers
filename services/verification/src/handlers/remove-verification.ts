import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload } from '../types';

interface RemoveVerificationOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly id: string };
}

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
