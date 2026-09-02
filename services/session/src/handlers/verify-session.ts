import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { ACCESS_TOKEN_DURATION } from '../consts';
import { createJWT } from '../create-jwt';
import { isDeadlockError } from '../is-deadlock-error';
import type { EmptyErrorPayload, SessionSigningDeps } from '../types';

interface VerifySessionOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly id: string };
}

export async function verifySession(
  db: Kysely<DB>,
  deps: SessionSigningDeps,
  opts: VerifySessionOpts,
): Promise<{ accessToken: string; refreshToken: string }> {
  const session = await db
    .selectFrom('sessions')
    .selectAll()
    .where('id', '=', opts.input.id)
    .where('verified', '=', false)
    .executeTakeFirst();

  if (session === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_DURATION);

  const tokenPair = await Promise.all([
    createJWT({
      apiIdentifier: deps.apiIdentifier,
      expiresAt: session.expiresAt,
      signingKey: deps.signingKey,
      userID: session.userId,
    }),
    createJWT({
      apiIdentifier: deps.apiIdentifier,
      expiresAt: accessTokenExpiresAt,
      signingKey: deps.signingKey,
      userID: session.userId,
    }),
  ]);

  const verified = await runVerifyAndEvict(db, session.id, tokenPair[0]);

  if (verified.length === 0) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return { accessToken: tokenPair[1], refreshToken: tokenPair[0] };
}

async function runVerifyAndEvict(
  db: Kysely<DB>,
  sessionId: string,
  refreshToken: string,
): Promise<Array<{ readonly id: string }>> {
  // two pending sessions of the same user verifying concurrently deadlock in postgres (SQLSTATE
  // 40P01): each statement's update locks its own row while its delete waits on the other's, so
  // the loser retries once and finds its row already evicted
  try {
    return await runVerifyAndEvictStatement(db, sessionId, refreshToken);
  } catch (error: unknown) {
    if (!isDeadlockError(error)) {
      throw error;
    }

    return runVerifyAndEvictStatement(db, sessionId, refreshToken);
  }
}

function runVerifyAndEvictStatement(
  db: Kysely<DB>,
  sessionId: string,
  refreshToken: string,
): Promise<Array<{ readonly id: string }>> {
  return db
    .with('verified', (qb) =>
      qb
        .updateTable('sessions')
        .set({ refreshToken, verified: true })
        .where('id', '=', sessionId)
        .where('verified', '=', false)
        .returning(['id', 'userId']),
    )
    .with('evicted', (qb) =>
      qb
        .deleteFrom('sessions')
        .where('userId', 'in', (eb) => eb.selectFrom('verified').select('userId'))
        .where('id', '<>', sessionId)
        .returning('id'),
    )
    .selectFrom('verified')
    .select('id')
    .execute();
}
