import { expect, test } from 'bun:test';
import { createContentVersion } from '@vers/content-registry';
import type { ActivityContract } from '@vers/contract-activity';
import { EncounterNodeSchema } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { buildMockScopeSecret } from '@vers/mock-services/keys';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { buildRPCTestClient } from '@vers/test-utils';
import { deriveWorldmapContent } from '@vers/worldmap-content';
import { ORIGIN_CELL } from '@vers/worldmap-core';
import { createActivityService } from '../create-activity-service';

// the handler commits its rows in its own interactive transaction, which the default
// transaction-isolation handle can't nest — this suite runs against a committed schema clone
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });
  const service = await createActivityService({ db: db.db });
  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  return {
    client: buildRPCTestClient<ActivityContract>(service.app, { token: viewer.token }),
    db: db.db,
    [Symbol.asyncDispose]: db[Symbol.asyncDispose],
  };
}

test('it creates a QA account with one verified run per requested run and returns the password it set', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db, { status: 'active' });
  await createContentVersion(ctx.db, createMockContentDocument({ contentVersion: '2' }));

  const account = await ctx.client.createQAAccount({
    level: 6,
    password: 'quiet-harbour-41',
    runs: 2,
    twoFactor: false,
    user: 'qa-heron',
  });

  expect(account).toStrictEqual({
    avatar: {
      id: expect.toBeString(),
      level: expect.toBeNumber(),
      name: 'qaheron',
      xp: expect.toBeNumber(),
    },
    password: 'quiet-harbour-41',
    runs: [
      {
        checkpoints: expect.toBeWithin(2, Number.MAX_SAFE_INTEGER),
        id: expect.toStartWith('act_'),
        items: expect.toBeNumber(),
        outcome: expect.toBeOneOf(['completed', 'failed']),
        xpDelta: expect.toBeNumber(),
      },
      {
        checkpoints: expect.toBeWithin(2, Number.MAX_SAFE_INTEGER),
        id: expect.toStartWith('act_'),
        items: expect.toBeNumber(),
        outcome: expect.toBeOneOf(['completed', 'failed']),
        xpDelta: expect.toBeNumber(),
      },
    ],
    twoFactor: null,
    user: { email: 'qa-heron@qa.versidle.com', id: expect.toBeString(), username: 'qa_heron' },
  });
});

test("it derives each run's encounter from the keys service's scope secret for the avatar", async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db, { status: 'active' });

  const document = createMockContentDocument({ contentVersion: '2' });

  await createContentVersion(ctx.db, document);

  const account = await ctx.client.createQAAccount({
    level: 2,
    runs: 1,
    twoFactor: false,
    user: 'qa-wren',
  });

  const avatar = await ctx.db
    .selectFrom('avatars')
    .select(['id', 'seed'])
    .where('id', '=', account.avatar.id)
    .executeTakeFirstOrThrow();

  const activity = await ctx.db
    .selectFrom('activities')
    .select('encounterNode')
    .where('avatarId', '=', avatar.id)
    .executeTakeFirstOrThrow();

  const expected = deriveWorldmapContent(document.encounter, {
    coord: ORIGIN_CELL,
    scopeSecret: buildMockScopeSecret(avatar.id, 'worldmap', 1),
    userSeed: avatar.seed,
  });

  expect(EncounterNodeSchema.parse(activity.encounterNode)).toStrictEqual({
    difficulty: expect.toBeNumber(),
    ...expected,
  });
});

test('it generates and returns a password when the request carries none', async () => {
  await using ctx = await setupTest();

  const account = await ctx.client.createQAAccount({
    level: 1,
    runs: 0,
    twoFactor: false,
    user: 'qa-plover',
  });

  const user = await ctx.db
    .selectFrom('users')
    .select('passwordHash')
    .where('id', '=', account.user.id)
    .executeTakeFirstOrThrow();

  expect(Bun.password.verify(account.password, user.passwordHash ?? '')).resolves.toBeTrue();
});

test('it refuses an address that already has an account with CONFLICT', async () => {
  await using ctx = await setupTest();

  await ctx.client.createQAAccount({ level: 1, runs: 0, twoFactor: false, user: 'qa-egret' });

  expect(
    ctx.client.createQAAccount({ level: 1, runs: 0, twoFactor: false, user: 'qa-egret' }),
  ).rejects.toMatchObject({
    code: 'CONFLICT',
    data: { field: 'email', value: 'qa-egret@qa.versidle.com' },
  });
});

test('it refuses a name whose username another account holds with CONFLICT on the username', async () => {
  await using ctx = await setupTest();

  await ctx.client.createQAAccount({ level: 1, runs: 0, twoFactor: false, user: 'qa-007' });

  expect(
    ctx.client.createQAAccount({ level: 1, runs: 0, twoFactor: false, user: 'qa.007' }),
  ).rejects.toMatchObject({ code: 'CONFLICT', data: { field: 'username', value: 'qa_007' } });
});

test('it refuses an address outside the QA domain with QA_ACCOUNT_NAME_INVALID', async () => {
  await using ctx = await setupTest();

  expect(
    ctx.client.createQAAccount({
      level: 1,
      runs: 0,
      twoFactor: false,
      user: 'player@versidle.com',
    }),
  ).rejects.toMatchObject({ code: 'QA_ACCOUNT_NAME_INVALID' });
});

test('it refuses a level above 1 with no runs before it writes an account', async () => {
  await using ctx = await setupTest();

  expect(
    ctx.client.createQAAccount({ level: 6, runs: 0, twoFactor: false, user: 'qa-crane' }),
  ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
});
