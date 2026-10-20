import type { SessionData } from '@vers/contract-session';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { MissingSessionPayload } from '../types';
import { toSessionData } from './to-session-data';

interface ReadSessionOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly id: string };
}

export async function readSession(
  db: Kysely<DB>,
  opts: ReadSessionOpts,
): Promise<SessionData | null> {
  if (opts.context.actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const row = await db
    .selectFrom('sessions')
    .selectAll()
    .where('id', '=', opts.input.id)
    .where('userId', '=', opts.context.actingUserID)
    .executeTakeFirst();

  return row === undefined ? null : toSessionData(row);
}
