import { ROTATION_GRACE_DURATION } from '@vers/contract-session';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import { match } from 'ts-pattern';
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
  readonly now: Date;
  readonly opts: RefreshTokensOpts;
}

export async function refreshTokens(
  db: Kysely<DB>,
  deps: SessionSigningDeps,
  opts: RefreshTokensOpts,
): Promise<RefreshedTokens> {
  const call: RefreshCall = { db, deps, now: new Date(), opts };

  const decision = await readRefreshDecision(call);

  if (decision.kind !== 'rotate') {
    return applyRefreshDecision(call, decision);
  }

  const rotated = await rotateRefreshToken(call, decision);

  if (rotated !== null) {
    return rotated;
  }

  const raceDecision = await readRefreshDecision(call);

  invariant(
    raceDecision.kind !== 'rotate',
    'a lost rotation leaves the presented token no longer current',
  );

  return applyRefreshDecision(call, raceDecision);
}

async function readRefreshDecision(call: RefreshCall): Promise<RefreshDecision> {
  const row = await call.db
    .selectFrom('sessions')
    .selectAll()
    .where('id', '=', call.opts.input.id)
    .executeTakeFirst();

  return classifyRefresh(row, call.opts.input.refreshToken, call.now);
}

function applyRefreshDecision(
  call: RefreshCall,
  decision: Exclude<RefreshDecision, { kind: 'rotate' }>,
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
      const tokens = await signAccessToken(call, grace);

      recordRotationGraceReply();

      return tokens;
    })
    .with({ kind: 'renew' }, (renew) => signAccessToken(call, renew))
    .exhaustive();
}

async function removeSessionRow(call: RefreshCall): Promise<void> {
  await call.db.deleteFrom('sessions').where('id', '=', call.opts.input.id).execute();
}

type KeptRefreshToken = Extract<RefreshDecision, { kind: 'grace' | 'renew' }>;

async function signAccessToken(
  call: RefreshCall,
  kept: KeptRefreshToken,
): Promise<RefreshedTokens> {
  const accessToken = await createJWT({
    apiIdentifier: call.deps.apiIdentifier,
    expiresAt: new Date(call.now.getTime() + ACCESS_TOKEN_DURATION),
    keyID: call.deps.keyID,
    signingKey: call.deps.signingKey,
    userID: kept.userID,
  });

  return { accessToken, refreshToken: kept.refreshToken };
}

async function rotateRefreshToken(
  call: RefreshCall,
  rotate: Extract<RefreshDecision, { kind: 'rotate' }>,
): Promise<null | RefreshedTokens> {
  const accessTokenExpiresAt = new Date(call.now.getTime() + ACCESS_TOKEN_DURATION);
  const rotationGraceUntil = new Date(call.now.getTime() + ROTATION_GRACE_DURATION);

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
