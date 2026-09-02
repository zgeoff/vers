import type { SessionData } from '@vers/contract-session';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { MissingSessionPayload } from '../types';
import { toSessionData } from './to-session-data';

/**
 * oRPC handler opts for the authed `getSession` procedure.
 */
interface GetSessionOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly id: string };
}

/**
 * Returns a session owned by the acting user, or null when it doesn't exist or isn't theirs.
 */
export async function getSession(
  db: Kysely<DB>,
  opts: GetSessionOpts,
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
