import { expect, onTestFinished, test } from 'bun:test';
import {
  createActivityRow,
  createAvatarRow,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { makeReadVerifiedAges } from './make-read-verified-ages';

async function setupTest() {
  const testDB = await createTestDB({ isolation: 'schema' });

  onTestFinished(() => testDB[Symbol.asyncDispose]());

  return { db: testDB.db };
}

test('it reads one age for each checkpoint proved since the last read', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });
  const activity = await createActivityRow(ctx.db, { appendedHead: 3, avatarId: avatar.id });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values([
      { activityId: activity.id, hash: 'h1', payload: {}, prevHash: 'h0', version: 1 },
      { activityId: activity.id, hash: 'h2', payload: {}, prevHash: 'h1', version: 2 },
      { activityId: activity.id, hash: 'h3', payload: {}, prevHash: 'h2', version: 3 },
    ])
    .execute();

  const readVerifiedAges = makeReadVerifiedAges(ctx.db);

  await readVerifiedAges();

  await ctx.db
    .updateTable('activities')
    .set({ verifiedHead: 2 })
    .where('id', '=', activity.id)
    .execute();

  const ages = await readVerifiedAges();

  expect(ages).toHaveLength(2);
  expect(ages).toSatisfyAll((ageMs: number) => ageMs >= 0);
});

test('it reads no age for a checkpoint proved before its first read', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  const activity = await createActivityRow(ctx.db, {
    appendedHead: 1,
    avatarId: avatar.id,
    verifiedHead: 1,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values({ activityId: activity.id, hash: 'h1', payload: {}, prevHash: 'h0', version: 1 })
    .execute();

  const readVerifiedAges = makeReadVerifiedAges(ctx.db);

  const ages = await readVerifiedAges();

  expect(ages).toStrictEqual([]);
});

test('it reads the age of a proof whose transaction commits after a read', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });
  const activity = await createActivityRow(ctx.db, { appendedHead: 1, avatarId: avatar.id });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values({ activityId: activity.id, hash: 'h1', payload: {}, prevHash: 'h0', version: 1 })
    .execute();

  const readVerifiedAges = makeReadVerifiedAges(ctx.db);
  const updated = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();

  await readVerifiedAges();

  const apply = ctx.db.transaction().execute(async (trx) => {
    await trx
      .updateTable('activities')
      .set({ verifiedAt: new Date(), verifiedHead: 1 })
      .where('id', '=', activity.id)
      .execute();

    updated.resolve();

    await release.promise;
  });

  await updated.promise;

  const whileOpen = await readVerifiedAges();

  release.resolve();

  await apply;

  const afterCommit = await readVerifiedAges();

  expect(whileOpen).toStrictEqual([]);
  expect(afterCommit).toHaveLength(1);
});
