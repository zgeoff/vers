import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { ACCESS_TOKEN_DURATION } from '../consts';
import { createJWT } from '../create-jwt';
import type { EmptyErrorPayload, SessionSigningDeps } from '../types';

/** oRPC handler opts for the public `verifySession` procedure. */
interface VerifySessionOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly id: string };
}

/**
 * Completes a 2FA-gated login: mints the session's first token pair, then flips `verified` in a
 * conditional update guarded on the same `verified = false` precondition the select used, so a
 * concurrent second verify of the same session finds no row to update.
 */
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

  const refreshToken = tokenPair[0];
  const accessToken = tokenPair[1];

  const updateResult = await db
    .updateTable('sessions')
    .set({ refreshToken, verified: true })
    .where('id', '=', session.id)
    .where('verified', '=', false)
    .executeTakeFirst();

  if (updateResult.numUpdatedRows === 0n) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return { accessToken, refreshToken };
}
