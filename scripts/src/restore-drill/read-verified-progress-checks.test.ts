import { expect, test } from 'bun:test';
import {
  createActivityRow,
  createAvatarRow,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { readVerifiedProgressChecks } from './read-verified-progress-checks';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it finds no violation when the heads match the stream and XP settles only from proof', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    id: 'act_settled',
    settledXp: 40,
    status: 'stopped',
    verifiedHead: 2,
  });

  await createActivityRow(ctx.db, { avatarId: avatar.id, id: 'act_fresh' });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values([
      { activityId: 'act_settled', hash: 'hash-1', payload: {}, prevHash: 'hash-0', version: 1 },
      { activityId: 'act_settled', hash: 'hash-2', payload: {}, prevHash: 'hash-1', version: 2 },
    ])
    .execute();

  const checks = await readVerifiedProgressChecks(ctx.db);

  expect(checks).toStrictEqual([
    {
      area: 'verified-progress',
      name: 'the verified head sits at or behind the appended head',
      violations: [],
    },
    {
      area: 'verified-progress',
      name: 'the appended head matches the stream’s last checkpoint',
      violations: [],
    },
    {
      area: 'verified-progress',
      name: 'settled XP comes only from verified checkpoints',
      violations: [],
    },
  ]);
});

test('it reports an activity verified past its appended head', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 1,
    avatarId: avatar.id,
    id: 'act_overrun',
    verifiedHead: 3,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values({
      activityId: 'act_overrun',
      hash: 'hash-1',
      payload: {},
      prevHash: 'hash-0',
      version: 1,
    })
    .execute();

  const checks = await readVerifiedProgressChecks(ctx.db);

  expect(checks[0]).toStrictEqual({
    area: 'verified-progress',
    name: 'the verified head sits at or behind the appended head',
    violations: ['activity act_overrun'],
  });
});

test('it reports an activity whose appended head runs past its stored checkpoints', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, { appendedHead: 3, avatarId: avatar.id, id: 'act_hollow' });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values({
      activityId: 'act_hollow',
      hash: 'hash-1',
      payload: {},
      prevHash: 'hash-0',
      version: 1,
    })
    .execute();

  const checks = await readVerifiedProgressChecks(ctx.db);

  expect(checks[1]).toStrictEqual({
    area: 'verified-progress',
    name: 'the appended head matches the stream’s last checkpoint',
    violations: ['activity act_hollow'],
  });
});

test('it reports an activity that settled XP with nothing verified', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, { avatarId: avatar.id, id: 'act_unproved', settledXp: 25 });

  const checks = await readVerifiedProgressChecks(ctx.db);

  expect(checks[2]).toStrictEqual({
    area: 'verified-progress',
    name: 'settled XP comes only from verified checkpoints',
    violations: ['activity act_unproved'],
  });
});
