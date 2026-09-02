import type { SessionData } from '@vers/contract-session';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { MissingSessionPayload } from '../types';
import { toSessionData } from './to-session-data';

/**
 * oRPC handler opts for the authed `getSessions` procedure.
 */
interface GetSessionsOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
}

/**
 * Lists every session owned by the acting user.
 */
export async function getSessions(
  db: Kysely<DB>,
  opts: GetSessionsOpts,
): Promise<Array<SessionData>> {
  if (opts.context.actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const rows = await db
    .selectFrom('sessions')
    .selectAll()
    .where('userId', '=', opts.context.actingUserID)
    .execute();

  return rows.map((row) => toSessionData(row));
}
