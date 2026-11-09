import { generateTOTP, getTOTPAuthUri } from '@epic-web/totp';
import { createId } from '@paralleldrive/cuid2';
import { readContentDocument, readCurrentContentVersion } from '@vers/content-registry';
import type { QAAccount } from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import type { DB } from '@vers/db';
import { toJSON } from '@vers/db';
import { createSeed } from '@vers/game-utils';
import { buildLevelFromXP, buildXPThreshold } from '@vers/idle-core';
import { readCurrentSimVersion } from '@vers/sim-registry';
import type { Kysely } from 'kysely';
import { planQARuns } from './plan-qa-runs';
import type { AvatarKeys, QARunsPlan, QAUser, SeedEntropy } from './types';

export interface ApplyQASeedDeps {
  readonly db: Kysely<DB>;
  readonly readAvatarKeys: (avatarID: string) => Promise<AvatarKeys>;
}

export interface ApplyQASeedInput {
  readonly entropy: SeedEntropy;
  readonly keyVersion: number;
  readonly level: number;
  readonly now: Date;
  readonly password: string;
  readonly runs: number;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
  readonly twoFactor: boolean;
  readonly user: QAUser;
}

export type QASeedResult = Omit<QAAccount, 'password'>;

export type QASeedOutcome =
  | { readonly account: QASeedResult; readonly kind: 'created' }
  | { readonly kind: 'exists' };

export async function applyQASeed(
  deps: Readonly<ApplyQASeedDeps>,
  input: Readonly<ApplyQASeedInput>,
): Promise<QASeedOutcome> {
  const existing = await deps.db
    .selectFrom('users')
    .select('id')
    .where('email', '=', input.user.email)
    .executeTakeFirst();

  if (existing !== undefined) {
    return { kind: 'exists' };
  }

  const userID = createId();
  const avatarID = createId();
  const startXP = buildXPThreshold(input.level);
  const plan = input.runs > 0 ? await planRuns(deps, input, avatarID, startXP) : undefined;
  const finalXP = plan?.finalXP ?? startXP;

  const passwordHash = await Bun.password.hash(input.password, 'argon2id');

  const twoFactor = input.twoFactor ? await createTwoFactor(userID) : undefined;

  await deps.db.transaction().execute(async (trx) => {
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
    account: {
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
    },
    kind: 'created',
  };
}

async function planRuns(
  deps: Readonly<ApplyQASeedDeps>,
  input: Readonly<ApplyQASeedInput>,
  avatarID: string,
  startXP: number,
): Promise<QARunsPlan> {
  const simVersion = await readCurrentSimVersion(deps.db);

  if (simVersion === undefined) {
    throw new Error('the sim_versions registry has no active version to stamp on a run');
  }

  const contentVersion = await readCurrentContentVersion(deps.db);

  if (contentVersion === undefined) {
    throw new Error('the content registry has no current version to run against');
  }

  const document = await readContentDocument(deps.db, contentVersion);

  if (document === undefined) {
    throw new Error(`current content version ${contentVersion} is not published`);
  }

  const keys = await deps.readAvatarKeys(avatarID);

  return planQARuns({
    activityIDs: Array.from({ length: input.runs }, () => `act_${createId()}`),
    avatarID,
    document,
    genesisSeed: input.entropy.genesisSeed,
    keyVersion: input.keyVersion,
    now: input.now,
    rollKey: keys.rollKey,
    scopeSecret: keys.scopeSecret,
    secretRef: input.secretRef,
    secretVersion: input.secretVersion,
    simVersion: simVersion.engineHash,
    startXP,
    userSeed: input.entropy.userSeed,
  });
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

const TWO_FACTOR_CHARSET = '0123456789';
const TWO_FACTOR_PERIOD_SECONDS = 30;

async function createTwoFactor(userID: string): Promise<TwoFactorSetup> {
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
