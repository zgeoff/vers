import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { waitFor } from '@vers/test-utils';
import { sql } from 'kysely';
import { createActivityRow } from '../test-utils/create-activity-row';
import { createChainRow } from '../test-utils/create-chain-row';
import { updateChainReplayPending } from './update-chain-replay-pending';

// the in-flight append test holds a row lock across two connections, which needs committed rows
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it clears the flag once every activity on the chain has verified to its head', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  const activity = await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
  });

  await ctx.db
    .updateTable('activities')
    .set({ verifiedHead: 3 })
    .where('id', '=', activity.id)
    .execute();

  await ctx.db.transaction().execute((trx) =>
    updateChainReplayPending(trx, {
      activityID: activity.id,
      avatarID: chain.avatarId,
      priority: 0,
      scopeID: chain.scopeId,
      scopeType: chain.scopeType,
    }),
  );

  const stored = await ctx.db
    .selectFrom('activityChains')
    .select('replayPending')
    .where('avatarId', '=', chain.avatarId)
    .executeTakeFirstOrThrow();

  expect(stored.replayPending).toBe(false);
});

test('it keeps the flag while a held activity on the chain has appends past its verified cursor', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  const parked = await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    status: 'parked',
    verifiedHead: 1,
  });

  await ctx.db.transaction().execute((trx) =>
    updateChainReplayPending(trx, {
      activityID: parked.id,
      avatarID: chain.avatarId,
      priority: 0,
      scopeID: chain.scopeId,
      scopeType: chain.scopeType,
    }),
  );

  const stored = await ctx.db
    .selectFrom('activityChains')
    .select('replayPending')
    .where('avatarId', '=', chain.avatarId)
    .executeTakeFirstOrThrow();

  expect(stored.replayPending).toBe(true);
});

test('it clears the flag when only a rejected activity has appends past its verified cursor', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  const activity = await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
  });

  await ctx.db
    .updateTable('activities')
    .set({ status: 'rejected' })
    .where('id', '=', activity.id)
    .execute();

  await ctx.db.transaction().execute((trx) =>
    updateChainReplayPending(trx, {
      activityID: activity.id,
      avatarID: chain.avatarId,
      priority: 0,
      scopeID: chain.scopeId,
      scopeType: chain.scopeType,
    }),
  );

  const stored = await ctx.db
    .selectFrom('activityChains')
    .select('replayPending')
    .where('avatarId', '=', chain.avatarId)
    .executeTakeFirstOrThrow();

  expect(stored.replayPending).toBe(false);
});

test('it waits for an append in flight on the chain and keeps the flag it would have set', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  const activity = await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    status: 'active',
    verifiedHead: 2,
  });

  const appended = Promise.withResolvers<undefined>();
  const release = Promise.withResolvers<undefined>();

  const append = ctx.db.transaction().execute(async (trx) => {
    await trx
      .updateTable('activities')
      .set({ appendedHead: 3 })
      .where('id', '=', activity.id)
      .execute();

    appended.resolve(undefined);

    await release.promise;
  });

  await appended.promise;

  const update = ctx.db.transaction().execute((trx) =>
    updateChainReplayPending(trx, {
      activityID: activity.id,
      avatarID: chain.avatarId,
      priority: 0,
      scopeID: chain.scopeId,
      scopeType: chain.scopeType,
    }),
  );

  await waitFor(async () => {
    const waiting = await sql`
      select count(*)::int as count
      from pg_stat_activity
      where datname = current_database() and wait_event_type = 'Lock'
    `.execute(ctx.db);

    expect(waiting.rows).toStrictEqual([{ count: 1 }]);
  });

  release.resolve(undefined);

  await append;
  await update;

  const stored = await ctx.db
    .selectFrom('activityChains')
    .select('replayPending')
    .where('avatarId', '=', chain.avatarId)
    .executeTakeFirstOrThrow();

  expect(stored.replayPending).toBe(true);
});
