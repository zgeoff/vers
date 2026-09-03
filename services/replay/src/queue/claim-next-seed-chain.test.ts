import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createActivityRow } from '../test-utils/create-activity-row';
import { createChainRow } from '../test-utils/create-chain-row';
import { claimNextSeedChain } from './claim-next-seed-chain';

// the claim is a `FOR UPDATE SKIP LOCKED` row lock held across concurrent transactions, which
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
