import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { sql } from 'kysely';
import { createActivityRow } from '../test-utils/create-activity-row';
import { createChainRow } from '../test-utils/create-chain-row';
import { claimNextSeedChain } from './claim-next-seed-chain';
import { updateReplayPendingChains } from './update-replay-pending-chains';

// the skipped-lock test holds a chain row across two connections, which needs committed rows
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it flags a chain whose unverified activity has every predecessor settled', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
  });

  await ctx.db
    .updateTable('activityChains')
    .set({ replayPending: false })
    .where('avatarId', '=', chain.avatarId)
    .execute();

  const repaired = await updateReplayPendingChains(ctx.db, chain.avatarId);

  expect(repaired).toStrictEqual({ cleared: 0, flagged: 1 });
});

test('it clears the flag on a chain whose only unverified activity waits behind a predecessor', async () => {
  await using ctx = await setupTest();

  const earlierChain = await createChainRow(ctx.db, { scopeId: '0_0' });

  const earlier = await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: earlierChain.avatarId,
    scopeId: '0_0',
    status: 'stopped',
  });

  await createChainRow(ctx.db, { avatarId: earlierChain.avatarId, scopeId: '0_1' });

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: earlierChain.avatarId,
    predecessorActivityId: earlier.id,
    scopeId: '0_1',
  });

  await ctx.db
    .updateTable('activityChains')
    .set({ replayPending: true })
    .where('avatarId', '=', earlierChain.avatarId)
    .execute();

  await updateReplayPendingChains(ctx.db, earlierChain.avatarId);

  const flags = await ctx.db
    .selectFrom('activityChains')
    .select(['replayPending', 'scopeId'])
    .where('avatarId', '=', earlierChain.avatarId)
    .orderBy('scopeId')
    .execute();

  expect(flags).toStrictEqual([
    { replayPending: true, scopeId: '0_0' },
    { replayPending: false, scopeId: '0_1' },
  ]);
});

test("it moves the flag to the successor's chain once the predecessor verifies", async () => {
  await using ctx = await setupTest();

  const earlierChain = await createChainRow(ctx.db, { scopeId: '0_0' });

  const earlier = await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: earlierChain.avatarId,
    scopeId: '0_0',
    status: 'stopped',
  });

  await createChainRow(ctx.db, { avatarId: earlierChain.avatarId, scopeId: '0_1' });

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: earlierChain.avatarId,
    predecessorActivityId: earlier.id,
    scopeId: '0_1',
  });

  await ctx.db
    .updateTable('activities')
    .set({ verifiedHead: 3 })
    .where('id', '=', earlier.id)
    .execute();

  await updateReplayPendingChains(ctx.db, earlierChain.avatarId);

  const flags = await ctx.db
    .selectFrom('activityChains')
    .select(['replayPending', 'scopeId'])
    .where('avatarId', '=', earlierChain.avatarId)
    .orderBy('scopeId')
    .execute();

  expect(flags).toStrictEqual([
    { replayPending: false, scopeId: '0_0' },
    { replayPending: true, scopeId: '0_1' },
  ]);
});

test('it keeps the flag on a chain whose next activity an operator holds', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    status: 'parked',
    verifiedHead: 1,
  });

  const repaired = await updateReplayPendingChains(ctx.db, chain.avatarId);

  expect(repaired).toStrictEqual({ cleared: 0, flagged: 0 });
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

  const repaired = await updateReplayPendingChains(ctx.db, chain.avatarId);

  expect(repaired).toStrictEqual({ cleared: 1, flagged: 0 });
});

test('it leaves the chains of other avatars alone when it repairs one avatar', async () => {
  await using ctx = await setupTest();

  const repairedChain = await createChainRow(ctx.db);
  const otherChain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: otherChain.avatarId,
    scopeId: otherChain.scopeId,
  });

  await ctx.db
    .updateTable('activityChains')
    .set({ replayPending: false })
    .where('avatarId', '=', otherChain.avatarId)
    .execute();

  const repaired = await updateReplayPendingChains(ctx.db, repairedChain.avatarId);

  expect(repaired).toStrictEqual({ cleared: 0, flagged: 0 });
});

test('it skips a chain another transaction holds instead of waiting on it', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
  });

  await ctx.db
    .updateTable('activityChains')
    .set({ replayPending: false })
    .where('avatarId', '=', chain.avatarId)
    .execute();

  const repaired = await ctx.db.transaction().execute(async (holder) => {
    await holder
      .selectFrom('activityChains')
      .select('avatarId')
      .where('avatarId', '=', chain.avatarId)
      .forUpdate()
      .execute();

    return updateReplayPendingChains(ctx.db, chain.avatarId);
  });

  expect(repaired).toStrictEqual({ cleared: 0, flagged: 0 });
});

test('it leaves 800 avatars with one flagged chain each, so a claim reads only the first', async () => {
  await using ctx = await setupTest();

  await sql`
    insert into users (id, email, name, username)
    select 'usr_' || n, 'player' || n || '@example.com', 'player' || n, 'player' || n
    from generate_series(1, 800) as n
  `.execute(ctx.db);

  await sql`
    insert into avatars (id, name, user_id)
    select 'avt_' || n, 'avatar' || n, 'usr_' || n from generate_series(1, 800) as n
  `.execute(ctx.db);

  await sql`
    insert into activity_chains
      (avatar_id, scope_type, scope_id, priority, replay_pending, genesis_seed, appended_next_seed, verified_next_seed)
    select 'avt_' || n, 'world_map_node', chain.scope_id, chain.priority, true, 'aa', 'aa', 'aa'
    from generate_series(1, 800) as n,
      (values ('0_0', 0), ('0_1', 10)) as chain (scope_id, priority)
  `.execute(ctx.db);

  await sql`
    insert into activities
      (id, avatar_id, scope_type, scope_id, predecessor_activity_id, appended_head, status,
       build_snapshot, content_version, encounter_node, last_hash, secret_ref, secret_version, seed,
       sim_version, start_hash)
    select 'act_' || n || '_0_0', 'avt_' || n, 'world_map_node', '0_0', null, 3, 'stopped',
      '{"level":1,"xp":0}', '2', '{"difficulty":1}', 'hash', 'worldmap', 1, 'aa', 'sim', 'hash'
    from generate_series(1, 800) as n
  `.execute(ctx.db);

  await sql`
    insert into activities
      (id, avatar_id, scope_type, scope_id, predecessor_activity_id, appended_head, status,
       build_snapshot, content_version, encounter_node, last_hash, secret_ref, secret_version, seed,
       sim_version, start_hash)
    select 'act_' || n || '_0_1', 'avt_' || n, 'world_map_node', '0_1', 'act_' || n || '_0_0', 3,
      'active', '{"level":1,"xp":0}', '2', '{"difficulty":1}', 'hash', 'worldmap', 1, 'aa', 'sim',
      'hash'
    from generate_series(1, 800) as n
  `.execute(ctx.db);

  const repaired = await updateReplayPendingChains(ctx.db, undefined);

  const flagged = await ctx.db
    .selectFrom('activityChains')
    .select(['priority', (eb) => eb.fn.countAll().as('chains')])
    .where('replayPending', '=', true)
    .groupBy('priority')
    .execute();

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(repaired).toStrictEqual({ cleared: 800, flagged: 0 });
  expect(flagged).toStrictEqual([{ chains: '800', priority: 0 }]);
  expect(claimed).toMatchObject({ priority: 0, scopeID: '0_0' });
});
