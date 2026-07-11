import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { ACCESS_TOKEN_DURATION, SESSION_DURATION_SHORT } from '../consts';
import { createJWT } from '../create-jwt';
import type { EmptyErrorPayload, SessionSigningDeps } from '../types';

/**
 * oRPC handler opts for the public `refreshTokens` procedure.
 */
interface RefreshTokensOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly REFRESH_TOKEN_REUSED: (payload: EmptyErrorPayload) => Error;
    readonly SESSION_EXPIRED: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly id: string; readonly refreshToken: string };
}

/**
 * Rotates a session's refresh token, or skips rotation inside the grace window. Reuse detection
 * (#154) keeps a one-deep history: `previousRefreshToken` is the last rotated-away token, so a
 * client that replays it (its own request having lost the race, or an attacker replaying a
 * stolen token) revokes the whole session rather than being silently ignored. Rotation itself is
 * one conditional UPDATE keyed on the refresh token it expects to replace — a concurrent
 * rotation's write invalidates that precondition, so at most one of two racing requests rotates
 * and the loser is treated as reuse.
 */
export async function refreshTokens(
  db: Kysely<DB>,
  deps: SessionSigningDeps,
  opts: RefreshTokensOpts,
): Promise<{ accessToken: string; refreshToken: string }> {
  const row = await db
    .selectFrom('sessions')
    .selectAll()
    .where('id', '=', opts.input.id)
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (row.expiresAt < new Date()) {
    await db.deleteFrom('sessions').where('id', '=', row.id).execute();

    throw opts.errors.SESSION_EXPIRED({ data: {} });
  }

  if (row.previousRefreshToken !== null && opts.input.refreshToken === row.previousRefreshToken) {
    await db.deleteFrom('sessions').where('id', '=', row.id).execute();

    throw opts.errors.REFRESH_TOKEN_REUSED({ data: {} });
  }

  if (row.refreshToken === null || opts.input.refreshToken !== row.refreshToken) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const sessionAge = Date.now() - row.createdAt.getTime();

  const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_DURATION);

  if (sessionAge < SESSION_DURATION_SHORT) {
    const accessToken = await createJWT({
      apiIdentifier: deps.apiIdentifier,
      expiresAt: accessTokenExpiresAt,
      signingKey: deps.signingKey,
      userID: row.userId,
    });

    return { accessToken, refreshToken: row.refreshToken };
  }

  const rotatedTokens = await Promise.all([
    createJWT({
      apiIdentifier: deps.apiIdentifier,
      expiresAt: row.expiresAt,
      signingKey: deps.signingKey,
      userID: row.userId,
    }),
    createJWT({
      apiIdentifier: deps.apiIdentifier,
      expiresAt: accessTokenExpiresAt,
      signingKey: deps.signingKey,
      userID: row.userId,
    }),
  ]);

  const updateResult = await db
    .updateTable('sessions')
    .set({ previousRefreshToken: row.refreshToken, refreshToken: rotatedTokens[0] })
    .where('id', '=', row.id)
    .where('refreshToken', '=', row.refreshToken)
    .executeTakeFirst();

  if (updateResult.numUpdatedRows === 0n) {
    await db.deleteFrom('sessions').where('id', '=', row.id).execute();

    throw opts.errors.REFRESH_TOKEN_REUSED({ data: {} });
  }

  return { accessToken: rotatedTokens[1], refreshToken: rotatedTokens[0] };
}
