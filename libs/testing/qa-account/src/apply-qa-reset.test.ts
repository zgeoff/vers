import { expect, test } from 'bun:test';
import { createContentVersion } from '@vers/content-registry';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import type { DB } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import type { Kysely } from 'kysely';
import { applyQAReset } from './apply-qa-reset';
import { applyQASeed } from './apply-qa-seed';

// applyQASeed and applyQAReset each commit in their own interactive transaction, which the default
// transaction-isolation handle can't nest — every test here runs against a committed schema clone.
async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB({ isolation: 'schema' });

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it clears the activity history and returns the avatar to level 1', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db, { status: 'active' });
  await createContentVersion(ctx.db, createMockContentDocument({ contentVersion: '2' }));

  const seeded = await applyQASeed(ctx.db, {
    entropy: { genesisSeed: '0123456789abcdef0123456789abcdef', userSeed: 7 },
    keyRoots: {
      rollKeyRoot: new Uint8Array(32).fill(3),
      scopeSecretRoot: new Uint8Array(32).fill(4),
    },
    level: 4,
    now: new Date(),
    password: 'known-password',
    runs: 1,
    twoFactor: false,
    user: {
      avatarName: 'qareset',
      email: 'qa-reset@qa.versidle.com',
      name: 'qa-reset',
      username: 'qa_reset',
    },
  });

  const reset = await applyQAReset(ctx.db, {
    all: false,
    user: {
      avatarName: 'qareset',
      email: 'qa-reset@qa.versidle.com',
      name: 'qa-reset',
      username: 'qa_reset',
    },
  });

  expect(reset).toStrictEqual({ activities: 1, avatars: 1, removedAccount: false });

  expect(
    ctx.db
      .selectFrom('avatars')
      .select(['level', 'xp'])
      .where('id', '=', seeded.avatar.id)
      .executeTakeFirst(),
  ).resolves.toStrictEqual({ level: 1, xp: 0 });

  expect(
    ctx.db.selectFrom('activities').select('id').where('avatarId', '=', seeded.avatar.id).execute(),
  ).resolves.toBeEmpty();

  expect(
    ctx.db
      .selectFrom('activityChains')
      .select('scopeId')
      .where('avatarId', '=', seeded.avatar.id)
      .execute(),
  ).resolves.toBeEmpty();

  expect(
    ctx.db
      .selectFrom('avatarGrants')
      .select('key')
      .where('avatarId', '=', seeded.avatar.id)
      .execute(),
  ).resolves.toBeEmpty();

  expect(
    ctx.db
      .selectFrom('avatarItems')
      .select('baseId')
      .where('avatarId', '=', seeded.avatar.id)
      .execute(),
  ).resolves.toBeEmpty();

  expect(
    ctx.db.selectFrom('users').select('id').where('id', '=', seeded.user.id).executeTakeFirst(),
  ).resolves.toStrictEqual({ id: seeded.user.id });
});

test('it removes the whole account with its two-factor row when asked for all', async () => {
  await using ctx = await setupTest();

  const seeded = await applyQASeed(ctx.db, {
    entropy: { genesisSeed: '0123456789abcdef0123456789abcdef', userSeed: 7 },
    keyRoots: undefined,
    level: 2,
    now: new Date(),
    password: 'known-password',
    runs: 0,
    twoFactor: true,
    user: {
      avatarName: 'qagone',
      email: 'qa-gone@qa.versidle.com',
      name: 'qa-gone',
      username: 'qa_gone',
    },
  });

  const reset = await applyQAReset(ctx.db, {
    all: true,
    user: {
      avatarName: 'qagone',
      email: 'qa-gone@qa.versidle.com',
      name: 'qa-gone',
      username: 'qa_gone',
    },
  });

  expect(reset).toStrictEqual({ activities: 0, avatars: 1, removedAccount: true });

  expect(
    ctx.db.selectFrom('users').select('id').where('id', '=', seeded.user.id).executeTakeFirst(),
  ).resolves.toBeUndefined();

  expect(
    ctx.db.selectFrom('avatars').select('id').where('id', '=', seeded.avatar.id).executeTakeFirst(),
  ).resolves.toBeUndefined();

  expect(
    ctx.db
      .selectFrom('verifications')
      .select('id')
      .where('target', '=', seeded.user.id)
      .executeTakeFirst(),
  ).resolves.toBeUndefined();
});

test('it reports a missing account instead of touching anything', async () => {
  await using ctx = await setupTest();

  expect(
    applyQAReset(ctx.db, {
      all: true,
      user: {
        avatarName: 'qamissing',
        email: 'qa-missing@qa.versidle.com',
        name: 'qa-missing',
        username: 'qa_missing',
      },
    }),
  ).rejects.toThrowWithMessage(Error, /no account exists/);
});
