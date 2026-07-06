import { createId } from '@paralleldrive/cuid2';
import type { SessionData } from '@vers/contract-session';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { SESSION_DURATION_LONG, SESSION_DURATION_SHORT } from '../consts';
import { toSessionData } from './to-session-data';

/** oRPC handler opts for the public `createSession` procedure. */
interface CreateSessionOpts {
  readonly input: {
    readonly expiresAt?: Date | undefined;
    readonly ipAddress: string;
    readonly rememberMe?: boolean | undefined;
    readonly userID: string;
  };
}

/** Creates an unverified session for a login, its expiry set by `rememberMe` unless overridden. */
export async function createSession(db: Kysely<DB>, opts: CreateSessionOpts): Promise<SessionData> {
  const { expiresAt, ipAddress, rememberMe, userID } = opts.input;

  const sessionDuration = rememberMe === true ? SESSION_DURATION_LONG : SESSION_DURATION_SHORT;
  const sessionExpiresAt = expiresAt ?? new Date(Date.now() + sessionDuration);

  const row = await db
    .insertInto('sessions')
    .values({
      expiresAt: sessionExpiresAt,
      id: createId(),
      ipAddress,
      previousRefreshToken: null,
      refreshToken: null,
      userId: userID,
      verified: false,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return toSessionData(row);
}
