import { expect, test } from 'bun:test';
import { createContentVersion } from '@vers/content-registry';
import { CheckpointPayloadSchema } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import type { Activities } from '@vers/db';
import { buildLevelFromXP } from '@vers/idle-core';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import type { Selectable } from 'kysely';
import invariant from 'tiny-invariant';
import { applyQASeed } from './apply-qa-seed';
import type { QASeedResult } from './apply-qa-seed';

// applyQASeed commits its rows in its own interactive transaction, which the default
// transaction-isolation handle can't nest — every test here runs against a committed schema clone.
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  const deps = {
    db: db.db,
    readAvatarKeys: () =>
      Promise.resolve({
        rollKey: new Uint8Array(32).fill(3),
        scopeSecret: new Uint8Array(32).fill(4),
      }),
  };

  return { db: db.db, deps, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it creates a verified account whose password checks and whose avatar starts at level 1 with no runs', async () => {
  await using ctx = await setupTest();

  const seeded = await applyQASeed(ctx.deps, {
    entropy: { genesisSeed: '0123456789abcdef0123456789abcdef', userSeed: 7 },
    keyVersion: 1,
    level: 1,
    now: new Date(),
    password: 'known-password',
    runs: 0,
    secretRef: 'worldmap',
    secretVersion: 1,
    twoFactor: false,
    user: {
      avatarName: 'qaaah',
      email: 'qa-007@qa.versidle.com',
      name: 'qa-007',
      username: 'qa_007',
    },
  });

  invariant(seeded.kind === 'created', 'a new address always gets an account');

  const user = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('email', '=', 'qa-007@qa.versidle.com')
    .executeTakeFirstOrThrow();

  invariant(user.passwordHash !== null, 'a seeded account always carries a password hash');

  const verified = await Bun.password.verify('known-password', user.passwordHash);

  expect(verified).toBe(true);
  expect(user).toMatchObject({ id: seeded.account.user.id, username: 'qa_007' });

  const avatar = await ctx.db
    .selectFrom('avatars')
    .selectAll()
    .where('userId', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(avatar).toMatchObject({
    id: seeded.account.avatar.id,
    isQa: true,
    level: 1,
    name: 'qaaah',
    xp: 0,
  });

  expect(
    ctx.db
      .selectFrom('activeAvatars')
      .select('avatarId')
      .where('userId', '=', user.id)
      .executeTakeFirst(),
  ).resolves.toStrictEqual({ avatarId: avatar.id });

  expect(seeded.account).toMatchObject({ runs: [], twoFactor: null });

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

  const seeded = await applyQASeed(ctx.deps, {
    entropy: { genesisSeed: '0123456789abcdef0123456789abcdef', userSeed: 7 },
    keyVersion: 1,
    level: 1,
    now: new Date(),
    password: 'known-password',
    runs: 0,
    secretRef: 'worldmap',
    secretVersion: 1,
    twoFactor: true,
    user: {
      avatarName: 'qacfa',
      email: 'qa-2fa@qa.versidle.com',
      name: 'qa-2fa',
      username: 'qa_2fa',
    },
  });

  invariant(seeded.kind === 'created', 'a new address always gets an account');

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('target', '=', seeded.account.user.id)
    .executeTakeFirstOrThrow();

  invariant(seeded.account.twoFactor !== null, 'a two-factor seed reports its secret');

  expect(row).toMatchObject({
    charSet: '0123456789',
    digits: 6,
    expiresAt: null,
    period: 30,
    secret: seeded.account.twoFactor.secret,
    type: '2fa',
  });

  expect(seeded.account.twoFactor.uri).toStartWith('otpauth://totp/');
});

test("it seeds verified origin runs whose chain anchors sit on the last run's tail", async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db, { status: 'active' });
  await createContentVersion(ctx.db, createMockContentDocument({ contentVersion: '2' }));

  const seeded = await applyQASeed(ctx.deps, {
    entropy: { genesisSeed: '0123456789abcdef0123456789abcdef', userSeed: 7 },
    keyVersion: 1,
    level: 6,
    now: new Date(),
    password: 'known-password',
    runs: 2,
    secretRef: 'worldmap',
    secretVersion: 1,
    twoFactor: false,
    user: {
      avatarName: 'qaruns',
      email: 'qa-runs@qa.versidle.com',
      name: 'qa-runs',
      username: 'qa_runs',
    },
  });

  invariant(seeded.kind === 'created', 'a new address always gets an account');

  const activities = await ctx.db
    .selectFrom('activities')
    .selectAll()
    .where('avatarId', '=', seeded.account.avatar.id)
    .orderBy('startedAt')
    .execute();

  expect(activities).toHaveLength(2);

  expect(activities).toSatisfyAll(
    (row: Readonly<Selectable<Activities>>) =>
      row.status === 'stopped' &&
      row.verifiedHead === row.appendedHead &&
      row.appendedHead > 1 &&
      row.keyVersion === 1 &&
      row.secretRef === 'worldmap' &&
      row.secretVersion === 1,
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
      .where('avatarId', '=', seeded.account.avatar.id)
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
    .where('id', '=', seeded.account.avatar.id)
    .executeTakeFirstOrThrow();

  expect(avatar.xp).toBe(2500 + seeded.account.runs.reduce((sum, run) => sum + run.xpDelta, 0));
  expect(avatar.level).toBe(buildLevelFromXP(avatar.xp));

  expect(seeded.account.runs).toSatisfyAll(
    (run: QASeedResult['runs'][number]) => run.outcome === 'completed',
  );

  expect(
    ctx.db
      .selectFrom('avatarGrants')
      .select(['key', 'kind'])
      .where('avatarId', '=', seeded.account.avatar.id)
      .execute(),
  ).resolves.toStrictEqual([{ key: '0_0', kind: 'first_clear' }]);
});

test('it reads the keys of the avatar it seeds runs for', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db, { status: 'active' });
  await createContentVersion(ctx.db, createMockContentDocument({ contentVersion: '2' }));

  const readAvatarIDs: Array<string> = [];

  const seeded = await applyQASeed(
    {
      db: ctx.db,
      readAvatarKeys: (avatarID) => {
        readAvatarIDs.push(avatarID);

        return ctx.deps.readAvatarKeys();
      },
    },
    {
      entropy: { genesisSeed: '0123456789abcdef0123456789abcdef', userSeed: 7 },
      keyVersion: 1,
      level: 2,
      now: new Date(),
      password: 'known-password',
      runs: 1,
      secretRef: 'worldmap',
      secretVersion: 1,
      twoFactor: false,
      user: {
        avatarName: 'qakeys',
        email: 'qa-keys@qa.versidle.com',
        name: 'qa-keys',
        username: 'qa_keys',
      },
    },
  );

  invariant(seeded.kind === 'created', 'a new address always gets an account');

  expect(readAvatarIDs).toStrictEqual([seeded.account.avatar.id]);
});

test('it reports an address that already has an account and writes nothing more', async () => {
  await using ctx = await setupTest();

  await applyQASeed(ctx.deps, {
    entropy: { genesisSeed: '0123456789abcdef0123456789abcdef', userSeed: 7 },
    keyVersion: 1,
    level: 1,
    now: new Date(),
    password: 'known-password',
    runs: 0,
    secretRef: 'worldmap',
    secretVersion: 1,
    twoFactor: false,
    user: {
      avatarName: 'qadup',
      email: 'qa-dup@qa.versidle.com',
      name: 'qa-dup',
      username: 'qa_dup',
    },
  });

  const second = await applyQASeed(ctx.deps, {
    entropy: { genesisSeed: '0123456789abcdef0123456789abcdef', userSeed: 7 },
    keyVersion: 1,
    level: 1,
    now: new Date(),
    password: 'other-password',
    runs: 0,
    secretRef: 'worldmap',
    secretVersion: 1,
    twoFactor: false,
    user: {
      avatarName: 'qadup',
      email: 'qa-dup@qa.versidle.com',
      name: 'qa-dup',
      username: 'qa_dup',
    },
  });

  expect(second).toStrictEqual({ kind: 'exists' });

  expect(
    ctx.db.selectFrom('users').select('id').where('email', '=', 'qa-dup@qa.versidle.com').execute(),
  ).resolves.toHaveLength(1);
});

test('it refuses runs when the registry has no active sim version', async () => {
  await using ctx = await setupTest();

  expect(
    applyQASeed(ctx.deps, {
      entropy: { genesisSeed: '0123456789abcdef0123456789abcdef', userSeed: 7 },
      keyVersion: 1,
      level: 1,
      now: new Date(),
      password: 'known-password',
      runs: 1,
      secretRef: 'worldmap',
      secretVersion: 1,
      twoFactor: false,
      user: {
        avatarName: 'qanosim',
        email: 'qa-nosim@qa.versidle.com',
        name: 'qa-nosim',
        username: 'qa_nosim',
      },
    }),
  ).rejects.toThrowWithMessage(Error, /no active version/u);
});
