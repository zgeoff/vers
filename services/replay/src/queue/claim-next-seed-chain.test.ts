import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { sql } from 'kysely';
import { createActivityRow } from '../test-utils/create-activity-row';
import { createChainRow } from '../test-utils/create-chain-row';
import { claimNextSeedChain } from './claim-next-seed-chain';

// the claim is a `FOR NO KEY UPDATE SKIP LOCKED` row lock held across concurrent transactions, which
// needs committed rows and independent connections, so this suite runs against a committed clone
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it claims an avatar with appends past the verified cursor', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  const activity = await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed).toStrictEqual({
    activityID: activity.id,
    avatarID: chain.avatarId,
    priority: 0,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });
});

test('it turns plan compilation off for the rest of the claiming transaction', async () => {
  await using ctx = await setupTest();

  const setting = await ctx.db.transaction().execute(async (trx) => {
    await claimNextSeedChain(trx);

    return sql`select current_setting('jit') as jit`.execute(trx);
  });

  expect(setting.rows).toStrictEqual([{ jit: 'off' }]);
});

test('it reports an empty queue as undefined', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    verifiedHead: 3,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed).toBeUndefined();
});

test('it claims the highest-priority avatar first', async () => {
  await using ctx = await setupTest();

  const routine = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 1,
    avatarId: routine.avatarId,
    scopeId: routine.scopeId,
  });

  const bumped = await createChainRow(ctx.db, { priority: 10 });

  await createActivityRow(ctx.db, {
    appendedHead: 1,
    avatarId: bumped.avatarId,
    scopeId: bumped.scopeId,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed).toMatchObject({ avatarID: bumped.avatarId, priority: 10 });
});

test('it skips an avatar another worker holds', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
  });

  const outcome = await ctx.db.transaction().execute(async (holder) => {
    const held = await claimNextSeedChain(holder);
    const contender = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

    return { contender, held };
  });

  expect(outcome.held).toMatchObject({ avatarID: chain.avatarId });
  expect(outcome.contender).toBeUndefined();
});

test('it skips an avatar whose claimable activity is quarantined', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    startChainIndex: 0,
    status: 'quarantined',
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed).toBeUndefined();
});

test('it skips a rejected predecessor and claims the honest activity behind it', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  const predecessor = await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    startChainIndex: 0,
    status: 'rejected',
  });

  const successor = await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: chain.avatarId,
    predecessorActivityId: predecessor.id,
    scopeId: chain.scopeId,
    startChainIndex: 3,
    status: 'active',
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed).toStrictEqual({
    activityID: successor.id,
    avatarID: chain.avatarId,
    priority: 0,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });
});

test('it does not re-claim an avatar whose only pending work is a rejected activity', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    startChainIndex: 0,
    status: 'rejected',
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed).toBeUndefined();
});

test('it skips an avatar whose claimable activity is parked', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    startChainIndex: 0,
    status: 'parked',
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed).toBeUndefined();
});

test('it blocks a successor whose predecessor still has appends past its verified cursor', async () => {
  await using ctx = await setupTest();

  const predecessorChain = await createChainRow(ctx.db, { scopeId: 'scope_predecessor' });

  const predecessor = await createActivityRow(ctx.db, {
    appendedHead: 4,
    avatarId: predecessorChain.avatarId,
    scopeId: 'scope_predecessor',
    status: 'stopped',
    verifiedHead: 1,
  });

  const successorChain = await createChainRow(ctx.db, { avatarId: predecessorChain.avatarId });

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: predecessorChain.avatarId,
    predecessorActivityId: predecessor.id,
    scopeId: successorChain.scopeId,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  // the predecessor's own seed chain is the one activity ready to claim; the successor stays
  // blocked
  expect(claimed).toStrictEqual({
    activityID: predecessor.id,
    avatarID: predecessorChain.avatarId,
    priority: 0,
    scopeID: 'scope_predecessor',
    scopeType: 'world_map_node',
  });
});

test('it claims a successor once its predecessor has fully verified', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createChainRow(ctx.db, { avatarId: chain.avatarId, scopeId: 'scope_predecessor' });

  const predecessor = await createActivityRow(ctx.db, {
    appendedHead: 4,
    avatarId: chain.avatarId,
    scopeId: 'scope_predecessor',
    status: 'stopped',
    verifiedHead: 4,
  });

  const successor = await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    predecessorActivityId: predecessor.id,
    scopeId: chain.scopeId,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed).toStrictEqual({
    activityID: successor.id,
    avatarID: chain.avatarId,
    priority: 0,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });
});

test('it blocks a successor whose predecessor is held by an operator', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createChainRow(ctx.db, { avatarId: chain.avatarId, scopeId: 'scope_predecessor' });

  const predecessor = await createActivityRow(ctx.db, {
    appendedHead: 4,
    avatarId: chain.avatarId,
    scopeId: 'scope_predecessor',
    status: 'parked',
    verifiedHead: 1,
  });

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    predecessorActivityId: predecessor.id,
    scopeId: chain.scopeId,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  // the predecessor's own status excludes it from claiming, and the held predecessor blocks the
  // successor behind it — the whole avatar stops
  expect(claimed).toBeUndefined();
});

test("it claims the avatar's origin activity with a null predecessor", async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  const activity = await createActivityRow(ctx.db, {
    appendedHead: 1,
    avatarId: chain.avatarId,
    predecessorActivityId: null,
    scopeId: chain.scopeId,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed).toMatchObject({ activityID: activity.id });
});

test('it skips an avatar whose claimable activity is backed off into the future', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    replayBackoffUntil: new Date(Date.now() + 60_000),
    scopeId: chain.scopeId,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed).toBeUndefined();
});

test('it claims an activity whose backoff has elapsed', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  const activity = await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    replayBackoffUntil: new Date(Date.now() - 1000),
    scopeId: chain.scopeId,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed?.activityID).toBe(activity.id);
});

test('it claims an earlier unsettled activity before a later one queued behind an activity that appended nothing', async () => {
  await using ctx = await setupTest();

  const laterChain = await createChainRow(ctx.db, { scopeId: '0_0' });

  await createChainRow(ctx.db, {
    appendedChainIndex: 12,
    avatarId: laterChain.avatarId,
    scopeId: '1_0',
    verifiedChainIndex: 9,
  });

  const earlier = await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: laterChain.avatarId,
    scopeId: '1_0',
    startChainIndex: 9,
    status: 'stopped',
  });

  const empty = await createActivityRow(ctx.db, {
    avatarId: laterChain.avatarId,
    predecessorActivityId: earlier.id,
    scopeId: '0_0',
    status: 'stopped',
  });

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: laterChain.avatarId,
    predecessorActivityId: empty.id,
    scopeId: '0_0',
    startChainIndex: 0,
    status: 'stopped',
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed?.activityID).toBe(earlier.id);
});

test('it waits on a predecessor that has not arrived', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    predecessorActivityId: 'act_undelivered',
    scopeId: chain.scopeId,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed).toBeUndefined();
});

test("it waits on a predecessor that names another avatar's settled activity", async () => {
  await using ctx = await setupTest();

  const foreignChain = await createChainRow(ctx.db);

  const foreign = await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: foreignChain.avatarId,
    scopeId: foreignChain.scopeId,
    status: 'stopped',
    verifiedHead: 3,
  });

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    predecessorActivityId: foreign.id,
    scopeId: chain.scopeId,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed).toBeUndefined();
});

test('it ends the walk back through earlier activities on a cycle of declared predecessors', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  const first = await createActivityRow(ctx.db, {
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    status: 'stopped',
  });

  const second = await createActivityRow(ctx.db, {
    avatarId: chain.avatarId,
    predecessorActivityId: first.id,
    scopeId: chain.scopeId,
    status: 'stopped',
  });

  await ctx.db
    .updateTable('activities')
    .set({ predecessorActivityId: second.id })
    .where('id', '=', first.id)
    .execute();

  const successor = await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    predecessorActivityId: second.id,
    scopeId: chain.scopeId,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed?.activityID).toBe(successor.id);
});

test('it skips a chain whose replay flag is clear', async () => {
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

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed).toBeUndefined();
});

test("it ranks an avatar by the chain of its next activity, not by a later chain's priority", async () => {
  await using ctx = await setupTest();

  const routine = await createChainRow(ctx.db, { priority: 0, scopeId: '0_0' });

  const earlier = await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: routine.avatarId,
    scopeId: '0_0',
    startChainIndex: 0,
    status: 'stopped',
  });

  await createChainRow(ctx.db, { avatarId: routine.avatarId, priority: 10, scopeId: '0_1' });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: routine.avatarId,
    predecessorActivityId: earlier.id,
    scopeId: '0_1',
    startChainIndex: 0,
  });

  const bumped = await createChainRow(ctx.db, { priority: 5 });

  const bumpedActivity = await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: bumped.avatarId,
    scopeId: bumped.scopeId,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextSeedChain(trx));

  expect(claimed).toStrictEqual({
    activityID: bumpedActivity.id,
    avatarID: bumped.avatarId,
    priority: 5,
    scopeID: bumped.scopeId,
    scopeType: bumped.scopeType,
  });
});

test('it leaves a claimed chain open to the key-share lock an append takes', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
  });

  const shared = await ctx.db.transaction().execute(async (holder) => {
    await claimNextSeedChain(holder);

    return ctx.db
      .selectFrom('activityChains')
      .select('avatarId')
      .where('avatarId', '=', chain.avatarId)
      .forKeyShare()
      .noWait()
      .execute();
  });

  expect(shared).toStrictEqual([{ avatarId: chain.avatarId }]);
});
