import { ROTATION_GRACE_DURATION } from '@vers/contract-session';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { match } from 'ts-pattern';
import { classifyLostRotation } from '../classify-lost-rotation';
import { classifyRefresh } from '../classify-refresh';
import { ACCESS_TOKEN_DURATION } from '../consts';
import { createJWT } from '../create-jwt';
import { recordRotationGraceReply } from '../metrics/record-rotation-grace-reply';
import type { EmptyErrorPayload, RefreshDecision, SessionSigningDeps } from '../types';

interface RefreshTokensOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly REFRESH_TOKEN_REUSED: (payload: EmptyErrorPayload) => Error;
    readonly SESSION_EXPIRED: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly id: string; readonly refreshToken: string };
}

interface RefreshedTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

interface RefreshCall {
  readonly db: Kysely<DB>;
  readonly deps: SessionSigningDeps;
  readonly opts: RefreshTokensOpts;
}

export async function refreshTokens(
  db: Kysely<DB>,
  deps: SessionSigningDeps,
  opts: RefreshTokensOpts,
): Promise<RefreshedTokens> {
  const call: RefreshCall = { db, deps, opts };

  const row = await readSessionRow(call);

  const now = new Date();

  const decision = classifyRefresh(row, opts.input.refreshToken, now);

  if (decision.kind !== 'rotate') {
    return applyRefreshDecision(call, decision, now);
  }

  const rotated = await rotateRefreshToken(call, decision, now);

  if (rotated !== null) {
    return rotated;
  }

  const raceRow = await readSessionRow(call);

  const raceNow = new Date();

  return applyRefreshDecision(
    call,
    classifyLostRotation(raceRow, opts.input.refreshToken, raceNow),
    raceNow,
  );
}

function readSessionRow(call: RefreshCall) {
  return call.db
    .selectFrom('sessions')
    .selectAll()
    .where('id', '=', call.opts.input.id)
    .executeTakeFirst();
}

function applyRefreshDecision(
  call: RefreshCall,
  decision: Exclude<RefreshDecision, { kind: 'rotate' }>,
  now: Date,
): Promise<RefreshedTokens> {
  return match(decision)
    .with({ kind: 'missing' }, { kind: 'mismatch' }, () => {
      throw call.opts.errors.NOT_FOUND({ data: {} });
    })
    .with({ kind: 'expired' }, async () => {
      await removeSessionRow(call);

      throw call.opts.errors.SESSION_EXPIRED({ data: {} });
    })
    .with({ kind: 'reuse' }, async () => {
      await removeSessionRow(call);

      throw call.opts.errors.REFRESH_TOKEN_REUSED({ data: {} });
    })
    .with({ kind: 'grace' }, async (grace) => {
      const tokens = await signAccessToken(call, grace, now);

      recordRotationGraceReply();

      return tokens;
    })
    .with({ kind: 'renew' }, (renew) => signAccessToken(call, renew, now))
    .exhaustive();
}

async function removeSessionRow(call: RefreshCall): Promise<void> {
  await call.db.deleteFrom('sessions').where('id', '=', call.opts.input.id).execute();
}

type KeptRefreshToken = Extract<RefreshDecision, { kind: 'grace' | 'renew' }>;

async function signAccessToken(
  call: RefreshCall,
  kept: KeptRefreshToken,
  now: Date,
): Promise<RefreshedTokens> {
  const accessToken = await createJWT({
    apiIdentifier: call.deps.apiIdentifier,
    expiresAt: new Date(now.getTime() + ACCESS_TOKEN_DURATION),
    keyID: call.deps.keyID,
    signingKey: call.deps.signingKey,
    userID: kept.userID,
  });

  return { accessToken, refreshToken: kept.refreshToken };
}

async function rotateRefreshToken(
  call: RefreshCall,
  rotate: Extract<RefreshDecision, { kind: 'rotate' }>,
  now: Date,
): Promise<null | RefreshedTokens> {
  const accessTokenExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_DURATION);
  const rotationGraceUntil = new Date(now.getTime() + ROTATION_GRACE_DURATION);

  const [refreshToken, accessToken] = await Promise.all([
    createJWT({
      apiIdentifier: call.deps.apiIdentifier,
      expiresAt: rotate.expiresAt,
      keyID: call.deps.keyID,
      signingKey: call.deps.signingKey,
      userID: rotate.userID,
    }),
    createJWT({
      apiIdentifier: call.deps.apiIdentifier,
      expiresAt: accessTokenExpiresAt,
      keyID: call.deps.keyID,
      signingKey: call.deps.signingKey,
      userID: rotate.userID,
    }),
  ]);

  const updateResult = await call.db
    .updateTable('sessions')
    .set({ previousRefreshToken: rotate.refreshToken, refreshToken, rotationGraceUntil })
    .where('id', '=', call.opts.input.id)
    .where('refreshToken', '=', rotate.refreshToken)
    .executeTakeFirst();

  if (updateResult.numUpdatedRows === 0n) {
    return null;
  }

  return { accessToken, refreshToken };
}
