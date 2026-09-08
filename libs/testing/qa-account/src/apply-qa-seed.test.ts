import { expect, test } from 'bun:test';
import { createContentVersion } from '@vers/content-registry';
import { CheckpointPayloadSchema } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import type { Activities, DB } from '@vers/db';
import { buildLevelFromXP } from '@vers/idle-core';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import type { Kysely, Selectable } from 'kysely';
import invariant from 'tiny-invariant';
import { applyQASeed } from './apply-qa-seed';
import type { QASeedResult } from './apply-qa-seed';

// applyQASeed commits its rows in its own interactive transaction, which the default
// transaction-isolation handle can't nest — every test here runs against a committed schema clone.
async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB({ isolation: 'schema' });

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it creates a verified account whose password checks and whose avatar sits at the requested level', async () => {
  await using ctx = await setupTest();

  const seeded = await applyQASeed(ctx.db, {
    entropy: { genesisSeed: '0123456789abcdef0123456789abcdef', userSeed: 7 },
    keyRoots: undefined,
    level: 6,
    now: new Date(),
    password: 'known-password',
    runs: 0,
    twoFactor: false,
    user: {
      avatarName: 'qaaah',
      email: 'qa-007@qa.versidle.com',
      name: 'qa-007',
      username: 'qa_007',
    },
  });

  const user = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('email', '=', 'qa-007@qa.versidle.com')
    .executeTakeFirstOrThrow();

  invariant(user.passwordHash !== null, 'a seeded account always carries a password hash');

  const verified = await Bun.password.verify('known-password', user.passwordHash);

  expect(verified).toBe(true);
  expect(user).toMatchObject({ id: seeded.user.id, username: 'qa_007' });

  const avatar = await ctx.db
    .selectFrom('avatars')
    .selectAll()
    .where('userId', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(avatar).toMatchObject({
    id: seeded.avatar.id,
    isQa: true,
    level: 6,
    name: 'qaaah',
    xp: 2500,
  });

  expect(
    ctx.db
      .selectFrom('activeAvatars')
      .select('avatarId')
      .where('userId', '=', user.id)
      .executeTakeFirst(),
  ).resolves.toStrictEqual({ avatarId: avatar.id });

  expect(seeded).toMatchObject({ runs: [], twoFactor: null });

  expect(
    ctx.db
      .selectFrom('activityChains')
      .select('scopeId')
      .where('avatarId', '=', avatar.id)
      .executeTakeFirst(),
  ).resolves.toBeUndefined();
});

test('it writes a two-factor verification keyed on the user id when asked', async () => {
  await using ctx = await setupTest();

  const seeded = await applyQASeed(ctx.db, {
    entropy: { genesisSeed: '0123456789abcdef0123456789abcdef', userSeed: 7 },
    keyRoots: undefined,
    level: 1,
    now: new Date(),
    password: 'known-password',
    runs: 0,
    twoFactor: true,
    user: {
      avatarName: 'qacfa',
      email: 'qa-2fa@qa.versidle.com',
      name: 'qa-2fa',
      username: 'qa_2fa',
    },
  });

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('target', '=', seeded.user.id)
    .executeTakeFirstOrThrow();

  invariant(seeded.twoFactor !== null, 'a two-factor seed reports its secret');

  expect(row).toMatchObject({
    charSet: '0123456789',
    digits: 6,
    expiresAt: null,
    period: 30,
    secret: seeded.twoFactor.secret,
    type: '2fa',
  });

  expect(seeded.twoFactor.uri).toStartWith('otpauth://totp/');
});

test("it seeds verified origin runs whose chain anchors sit on the last run's tail", async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db, { status: 'active' });
  await createContentVersion(ctx.db, createMockContentDocument({ contentVersion: '2' }));

  const seeded = await applyQASeed(ctx.db, {
    entropy: { genesisSeed: '0123456789abcdef0123456789abcdef', userSeed: 7 },
    keyRoots: {
      rollKeyRoot: new Uint8Array(32).fill(3),
      scopeSecretRoot: new Uint8Array(32).fill(4),
    },
    level: 6,
    now: new Date(),
    password: 'known-password',
    runs: 2,
    twoFactor: false,
    user: {
      avatarName: 'qaruns',
      email: 'qa-runs@qa.versidle.com',
      name: 'qa-runs',
      username: 'qa_runs',
    },
  });

  const activities = await ctx.db
    .selectFrom('activities')
    .selectAll()
    .where('avatarId', '=', seeded.avatar.id)
    .orderBy('startedAt')
    .execute();

  expect(activities).toHaveLength(2);

  expect(activities).toSatisfyAll(
    (row: Readonly<Selectable<Activities>>) =>
      row.status === 'stopped' && row.verifiedHead === row.appendedHead && row.appendedHead > 1,
  );

  const [first, second] = activities;

  invariant(first !== undefined && second !== undefined, 'two runs were seeded');

  expect(second.predecessorActivityId).toBe(first.id);

  const tail = await ctx.db
    .selectFrom('activityCheckpoints')
    .selectAll()
    .where('activityId', '=', second.id)
    .where('version', '=', second.appendedHead)
    .executeTakeFirstOrThrow();

  const payload = CheckpointPayloadSchema.parse(tail.payload);

  expect(
    ctx.db
      .selectFrom('activityChains')
      .select(['appendedChainIndex', 'appendedNextSeed', 'verifiedChainIndex', 'verifiedNextSeed'])
      .where('avatarId', '=', seeded.avatar.id)
      .executeTakeFirst(),
  ).resolves.toStrictEqual({
    appendedChainIndex: payload.chainIndex,
    appendedNextSeed: payload.nextSeed,
    verifiedChainIndex: payload.chainIndex,
    verifiedNextSeed: payload.nextSeed,
  });

  const avatar = await ctx.db
    .selectFrom('avatars')
    .select(['level', 'xp'])
    .where('id', '=', seeded.avatar.id)
    .executeTakeFirstOrThrow();

  expect(avatar.xp).toBe(2500 + seeded.runs.reduce((sum, run) => sum + run.xpDelta, 0));
  expect(avatar.level).toBe(buildLevelFromXP(avatar.xp));

  expect(seeded.runs).toSatisfyAll(
    (run: QASeedResult['runs'][number]) => run.outcome === 'completed',
  );

  expect(
    ctx.db
      .selectFrom('avatarGrants')
      .select(['key', 'kind'])
      .where('avatarId', '=', seeded.avatar.id)
      .execute(),
  ).resolves.toStrictEqual([{ key: '0_0', kind: 'first_clear' }]);
});

test('it refuses to seed an address that already has an account', async () => {
  await using ctx = await setupTest();

  await applyQASeed(ctx.db, {
    entropy: { genesisSeed: '0123456789abcdef0123456789abcdef', userSeed: 7 },
    keyRoots: undefined,
    level: 1,
    now: new Date(),
    password: 'known-password',
    runs: 0,
    twoFactor: false,
    user: {
      avatarName: 'qadup',
      email: 'qa-dup@qa.versidle.com',
      name: 'qa-dup',
      username: 'qa_dup',
    },
  });

  expect(
    applyQASeed(ctx.db, {
      entropy: { genesisSeed: '0123456789abcdef0123456789abcdef', userSeed: 7 },
      keyRoots: undefined,
      level: 1,
      now: new Date(),
      password: 'other-password',
      runs: 0,
      twoFactor: false,
      user: {
        avatarName: 'qadup',
        email: 'qa-dup@qa.versidle.com',
        name: 'qa-dup',
        username: 'qa_dup',
      },
    }),
  ).rejects.toThrowWithMessage(Error, /already exists/);
});

test('it refuses runs when the registry has no active sim version', async () => {
  await using ctx = await setupTest();

  expect(
    applyQASeed(ctx.db, {
      entropy: { genesisSeed: '0123456789abcdef0123456789abcdef', userSeed: 7 },
      keyRoots: {
        rollKeyRoot: new Uint8Array(32).fill(3),
        scopeSecretRoot: new Uint8Array(32).fill(4),
      },
      level: 1,
      now: new Date(),
      password: 'known-password',
      runs: 1,
      twoFactor: false,
      user: {
        avatarName: 'qanosim',
        email: 'qa-nosim@qa.versidle.com',
        name: 'qa-nosim',
        username: 'qa_nosim',
      },
    }),
  ).rejects.toThrowWithMessage(Error, /no active version/);
});
