import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { MissingSessionPayload } from '../types';

interface RemoveSessionOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly id: string };
}

export async function removeSession(
  db: Kysely<DB>,
  opts: RemoveSessionOpts,
): Promise<Record<never, never>> {
  if (opts.context.actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  await db
    .deleteFrom('sessions')
    .where('id', '=', opts.input.id)
    .where('userId', '=', opts.context.actingUserID)
    .execute();

  return {};
}
