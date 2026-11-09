import { generateTOTP, getTOTPAuthUri } from '@epic-web/totp';
import { createId } from '@paralleldrive/cuid2';
import { readContentDocument, readCurrentContentVersion } from '@vers/content-registry';
import type { QAAccount } from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import type { DB } from '@vers/db';
import { toJSON } from '@vers/db';
import { createSeed } from '@vers/game-utils';
import { buildLevelFromXP, buildXPThreshold } from '@vers/idle-core';
import { isUniqueViolation } from '@vers/service-utils';
import { readCurrentSimVersion } from '@vers/sim-registry';
import type { Kysely } from 'kysely';
import { planQARuns } from './plan-qa-runs';
import type { AvatarKeys, QARunsPlan, QASeedClash, QAUser, SeedEntropy } from './types';

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
  | { readonly clash: QASeedClash; readonly kind: 'exists' };

export async function applyQASeed(
  deps: Readonly<ApplyQASeedDeps>,
  input: Readonly<ApplyQASeedInput>,
): Promise<QASeedOutcome> {
  const clash = await readQASeedClash(deps.db, input.user);

  if (clash !== null) {
    return { clash, kind: 'exists' };
  }

  const userID = createId();
  const avatarID = createId();
  const startXP = buildXPThreshold(input.level);
  const plan = input.runs > 0 ? await planRuns(deps, input, avatarID, startXP) : undefined;
  const finalXP = plan?.finalXP ?? startXP;

  const passwordHash = await Bun.password.hash(input.password, 'argon2id');

  const twoFactor = input.twoFactor ? await createTwoFactor(userID) : undefined;

  try {
    await writeAccount(deps.db, {
      avatarID,
      finalXP,
      input,
      passwordHash,
      plan,
      twoFactor,
      userID,
    });
  } catch (error) {
    // a concurrent seed of a clashing name commits between the read above and this write
    const raced = isUniqueViolation(error) ? await readQASeedClash(deps.db, input.user) : null;

    if (raced === null) {
      throw error;
    }

    return { clash: raced, kind: 'exists' };
  }

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

async function readQASeedClash(db: Kysely<DB>, user: QAUser): Promise<QASeedClash | null> {
  const [email, username, avatarName] = await Promise.all([
    db.selectFrom('users').select('id').where('email', '=', user.email).executeTakeFirst(),
    db.selectFrom('users').select('id').where('username', '=', user.username).executeTakeFirst(),
    db.selectFrom('avatars').select('id').where('name', '=', user.avatarName).executeTakeFirst(),
  ]);

  return pickQASeedClash(user, {
    avatarName: avatarName !== undefined,
    email: email !== undefined,
    username: username !== undefined,
  });
}

function pickQASeedClash(
  user: QAUser,
  taken: Readonly<Record<QASeedClash['field'], boolean>>,
): QASeedClash | null {
  if (taken.email) {
    return { field: 'email', value: user.email };
  }

  if (taken.username) {
    return { field: 'username', value: user.username };
  }

  if (taken.avatarName) {
    return { field: 'avatarName', value: user.avatarName };
  }

  return null;
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

interface WriteAccountInput {
  readonly avatarID: string;
  readonly finalXP: number;
  readonly input: Readonly<ApplyQASeedInput>;
  readonly passwordHash: string;
  readonly plan: QARunsPlan | undefined;
  readonly twoFactor: TwoFactorSetup | undefined;
  readonly userID: string;
}

async function writeAccount(db: Kysely<DB>, account: Readonly<WriteAccountInput>): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('users')
      .values({
        email: account.input.user.email,
        id: account.userID,
        name: account.input.user.name,
        passwordHash: account.passwordHash,
        seed: createSeed(),
        username: account.input.user.username,
      })
      .execute();

    await trx
      .insertInto('avatars')
      .values({
        id: account.avatarID,
        isQa: true,
        level: buildLevelFromXP(account.finalXP),
        name: account.input.user.avatarName,
        seed: account.input.entropy.userSeed,
        userId: account.userID,
        xp: account.finalXP,
      })
      .execute();

    await trx
      .insertInto('activeAvatars')
      .values({ avatarId: account.avatarID, userId: account.userID })
      .execute();

    if (account.twoFactor !== undefined) {
      await trx.insertInto('verifications').values(account.twoFactor.row).execute();
    }

    if (account.plan !== undefined) {
      await writeRuns(trx, account.plan, account.avatarID);
    }
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
