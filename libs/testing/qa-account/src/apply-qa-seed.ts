import { generateTOTP, getTOTPAuthUri } from '@epic-web/totp';
import { createId } from '@paralleldrive/cuid2';
import { findContentDocument, findCurrentContentVersion } from '@vers/content-registry';
import type { SecretRef } from '@vers/contract-keys';
import type { DB } from '@vers/db';
import { toJSON } from '@vers/db';
import { createSeed } from '@vers/game-utils';
import { buildLevelFromXP, buildXPThreshold } from '@vers/idle-core';
import { deriveAvatarKey, deriveScopeSecret } from '@vers/roll-crypto';
import { findCurrentSimVersion } from '@vers/sim-registry';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import { planQARuns } from './plan-qa-runs';
import type { KeyRoots, QARunsPlan, QAUser, RunOutcome, SeedEntropy } from './types';

// the versions service-activity stamps on every row it admits; the roots must carry them
export const QA_KEY_VERSION = 1;
const QA_SCOPE_SECRET_REF: SecretRef = 'worldmap';

export const QA_SCOPE_SECRET_VERSION = 1;
const TWO_FACTOR_CHARSET = '0123456789';
const TWO_FACTOR_PERIOD_SECONDS = 30;

export interface ApplyQASeedInput {
  readonly entropy: SeedEntropy;
  readonly keyRoots: KeyRoots | undefined;
  readonly level: number;
  readonly now: Date;
  readonly password: string;
  readonly runs: number;
  readonly twoFactor: boolean;
  readonly user: QAUser;
}

export interface QASeedResult {
  readonly avatar: {
    readonly id: string;
    readonly level: number;
    readonly name: string;
    readonly xp: number;
  };
  readonly runs: ReadonlyArray<{
    readonly checkpoints: number;
    readonly id: string;
    readonly items: number;
    readonly outcome: RunOutcome;
    readonly xpDelta: number;
  }>;
  readonly twoFactor: { readonly secret: string; readonly uri: string } | null;
  readonly user: { readonly email: string; readonly id: string; readonly username: string };
}

export async function applyQASeed(
  db: Kysely<DB>,
  input: Readonly<ApplyQASeedInput>,
): Promise<QASeedResult> {
  const existing = await db
    .selectFrom('users')
    .select('id')
    .where('email', '=', input.user.email)
    .executeTakeFirst();

  if (existing !== undefined) {
    throw new Error(
      `${input.user.email} already exists; run qa:reset --user ${input.user.name} --all first`,
    );
  }

  const userID = createId();
  const avatarID = createId();
  const startXP = buildXPThreshold(input.level);
  const plan = input.runs > 0 ? await planRuns(db, input, avatarID, startXP) : undefined;
  const finalXP = plan?.finalXP ?? startXP;

  const passwordHash = await Bun.password.hash(input.password, 'argon2id');

  const twoFactor = input.twoFactor ? await buildTwoFactor(userID) : undefined;

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('users')
      .values({
        email: input.user.email,
        id: userID,
        name: input.user.name,
        passwordHash,
        seed: createSeed(),
        username: input.user.username,
      })
      .execute();

    await trx
      .insertInto('avatars')
      .values({
        id: avatarID,
        isQa: true,
        level: buildLevelFromXP(finalXP),
        name: input.user.avatarName,
        seed: input.entropy.userSeed,
        userId: userID,
        xp: finalXP,
      })
      .execute();

    await trx.insertInto('activeAvatars').values({ avatarId: avatarID, userId: userID }).execute();

    if (twoFactor !== undefined) {
      await trx.insertInto('verifications').values(twoFactor.row).execute();
    }

    if (plan !== undefined) {
      await writeRuns(trx, plan, avatarID);
    }
  });

  return {
    avatar: {
      id: avatarID,
      level: buildLevelFromXP(finalXP),
      name: input.user.avatarName,
      xp: finalXP,
    },
    runs: (plan?.runs ?? []).map((run) => ({
      checkpoints: run.checkpoints.length,
      id: run.activity.id,
      items: run.items.length,
      outcome: run.outcome,
      xpDelta: run.xpDelta,
    })),
    twoFactor:
      twoFactor === undefined ? null : { secret: twoFactor.row.secret, uri: twoFactor.uri },
    user: { email: input.user.email, id: userID, username: input.user.username },
  };
}

async function planRuns(
  db: Kysely<DB>,
  input: Readonly<ApplyQASeedInput>,
  avatarID: string,
  startXP: number,
): Promise<QARunsPlan> {
  invariant(input.keyRoots !== undefined, 'seeding runs needs the scope-secret and roll-key roots');

  const simVersion = await findCurrentSimVersion(db);

  if (simVersion === undefined) {
    throw new Error('the sim_versions registry has no active version to stamp on a run');
  }

  const contentVersion = await findCurrentContentVersion(db);

  if (contentVersion === undefined) {
    throw new Error('the content registry has no current version to run against');
  }

  const document = await findContentDocument(db, contentVersion);

  if (document === undefined) {
    throw new Error(`current content version ${contentVersion} is not published`);
  }

  return planQARuns({
    activityIDs: Array.from({ length: input.runs }, () => `act_${createId()}`),
    avatarID,
    document,
    genesisSeed: input.entropy.genesisSeed,
    keyVersion: QA_KEY_VERSION,
    now: input.now,
    rollKey: deriveAvatarKey({
      avatarID,
      keyVersion: QA_KEY_VERSION,
      population: 'trade',
      root: input.keyRoots.rollKeyRoot,
    }),
    scopeSecret: deriveScopeSecret({
      avatarID,
      root: input.keyRoots.scopeSecretRoot,
      secretRef: QA_SCOPE_SECRET_REF,
      secretVersion: QA_SCOPE_SECRET_VERSION,
    }),
    secretRef: QA_SCOPE_SECRET_REF,
    secretVersion: QA_SCOPE_SECRET_VERSION,
    simVersion: simVersion.engineHash,
    startXP,
    userSeed: input.entropy.userSeed,
  });
}

async function writeRuns(trx: Kysely<DB>, plan: QARunsPlan, avatarID: string): Promise<void> {
  await trx.insertInto('activityChains').values(plan.chain).execute();

  for (const run of plan.runs) {
    await trx.insertInto('activities').values(run.activity).execute();

    await trx
      .insertInto('activityCheckpoints')
      .values(
        run.checkpoints.map((checkpoint) => ({
          activityId: run.activity.id,
          hash: checkpoint.hash,
          payload: toJSON(checkpoint.payload),
          prevHash: checkpoint.prevHash,
          version: checkpoint.version,
        })),
      )
      .execute();

    if (run.items.length > 0) {
      await trx.insertInto('avatarItems').values(run.items).execute();
    }
  }

  if (plan.clearedNodeIDs.length > 0) {
    await trx
      .insertInto('avatarGrants')
      .values(plan.clearedNodeIDs.map((key) => ({ avatarId: avatarID, key, kind: 'first_clear' })))
      .execute();
  }
}

interface TwoFactorSetup {
  readonly row: {
    readonly algorithm: string;
    readonly charSet: string;
    readonly digits: number;
    readonly expiresAt: null;
    readonly id: string;
    readonly period: number;
    readonly secret: string;
    readonly target: string;
    readonly type: '2fa';
  };
  readonly uri: string;
}

async function buildTwoFactor(userID: string): Promise<TwoFactorSetup> {
  const { otp, ...config } = await generateTOTP({
    algorithm: 'SHA-256',
    charSet: TWO_FACTOR_CHARSET,
    period: TWO_FACTOR_PERIOD_SECONDS,
  });

  const row = {
    algorithm: config.algorithm,
    charSet: config.charSet,
    digits: config.digits,
    expiresAt: null,
    id: createId(),
    period: config.period,
    secret: config.secret,
    target: userID,
    type: '2fa' as const,
  };

  return {
    row,
    uri: getTOTPAuthUri({
      accountName: userID,
      algorithm: row.algorithm,
      digits: row.digits,
      issuer: 'vers',
      period: row.period,
      secret: row.secret,
    }),
  };
}
