import type { DB, Sessions } from '@vers/db';
import type { Kysely, Selectable } from 'kysely';
import { ACCESS_TOKEN_DURATION, ROTATION_GRACE_DURATION, SESSION_DURATION_SHORT } from '../consts';
import { createJWT } from '../create-jwt';
import { recordRotationGraceReply } from '../metrics/record-rotation-grace-reply';
import type { EmptyErrorPayload, SessionSigningDeps } from '../types';

interface RefreshTokensOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly REFRESH_TOKEN_REUSED: (payload: EmptyErrorPayload) => Error;
    readonly SESSION_EXPIRED: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly id: string; readonly refreshToken: string };
}

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
    const graceReply = await buildGraceReply(deps, row);

    if (graceReply !== null) {
      recordRotationGraceReply();

      return graceReply;
    }

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
      keyID: deps.keyID,
      signingKey: deps.signingKey,
      userID: row.userId,
    });

    return { accessToken, refreshToken: row.refreshToken };
  }

  const rotatedTokens = await Promise.all([
    createJWT({
      apiIdentifier: deps.apiIdentifier,
      expiresAt: row.expiresAt,
      keyID: deps.keyID,
      signingKey: deps.signingKey,
      userID: row.userId,
    }),
    createJWT({
      apiIdentifier: deps.apiIdentifier,
      expiresAt: accessTokenExpiresAt,
      keyID: deps.keyID,
      signingKey: deps.signingKey,
      userID: row.userId,
    }),
  ]);

  const updateResult = await db
    .updateTable('sessions')
    .set({
      previousRefreshToken: row.refreshToken,
      refreshToken: rotatedTokens[0],
      rotationGraceUntil: new Date(Date.now() + ROTATION_GRACE_DURATION),
    })
    .where('id', '=', row.id)
    .where('refreshToken', '=', row.refreshToken)
    .executeTakeFirst();

  if (updateResult.numUpdatedRows === 0n) {
    const current = await db
      .selectFrom('sessions')
      .selectAll()
      .where('id', '=', row.id)
      .executeTakeFirst();

    if (current !== undefined && current.previousRefreshToken === opts.input.refreshToken) {
      const graceReply = await buildGraceReply(deps, current);

      if (graceReply !== null) {
        recordRotationGraceReply();

        return graceReply;
      }
    }

    await db.deleteFrom('sessions').where('id', '=', row.id).execute();

    throw opts.errors.REFRESH_TOKEN_REUSED({ data: {} });
  }

  return { accessToken: rotatedTokens[1], refreshToken: rotatedTokens[0] };
}

async function buildGraceReply(
  deps: SessionSigningDeps,
  row: Selectable<Sessions>,
): Promise<null | { accessToken: string; refreshToken: string }> {
  if (row.rotationGraceUntil === null || row.rotationGraceUntil <= new Date()) {
    return null;
  }

  if (row.refreshToken === null) {
    return null;
  }

  const accessToken = await createJWT({
    apiIdentifier: deps.apiIdentifier,
    expiresAt: new Date(Date.now() + ACCESS_TOKEN_DURATION),
    signingKey: deps.signingKey,
    userID: row.userId,
  });

  return { accessToken, refreshToken: row.refreshToken };
}
