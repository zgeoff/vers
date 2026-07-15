import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createActivityRow } from '../test-utils/create-activity-row';
import { createChainRow } from '../test-utils/create-chain-row';
import { claimNextChain } from './claim-next-chain';

/**
 * The claim is a `FOR UPDATE SKIP LOCKED` row lock held across concurrent transactions, which
 * needs real committed rows and independent connections — this suite runs against a real,
 * committed schema clone.
 */
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it claims a chain with appends past the verified cursor', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextChain(trx));

  expect(claimed).toStrictEqual({
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

  const claimed = await ctx.db.transaction().execute((trx) => claimNextChain(trx));

  expect(claimed).toBeUndefined();
});

test('it claims the highest-priority chain first', async () => {
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

  const claimed = await ctx.db.transaction().execute((trx) => claimNextChain(trx));

  expect(claimed).toMatchObject({ avatarID: bumped.avatarId, priority: 10 });
});

test('it skips a chain another worker holds', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
  });

  const outcome = await ctx.db.transaction().execute(async (holder) => {
    const held = await claimNextChain(holder);
    const contender = await ctx.db.transaction().execute((trx) => claimNextChain(trx));

    return { contender, held };
  });

  expect(outcome.held).toMatchObject({ avatarID: chain.avatarId });
  expect(outcome.contender).toBeUndefined();
});

test('it skips a chain whose replay frontier is quarantined', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    startChainIndex: 0,
    status: 'quarantined',
  });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    startChainIndex: 3,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextChain(trx));

  expect(claimed).toBeUndefined();
});

test('it skips a rejected frontier and claims an honest activity behind it', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    startChainIndex: 0,
    status: 'rejected',
  });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    startChainIndex: 3,
    status: 'active',
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextChain(trx));

  expect(claimed).toStrictEqual({
    avatarID: chain.avatarId,
    priority: 0,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });
});

test('it does not re-claim a chain whose only pending work is a rejected activity', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    startChainIndex: 0,
    status: 'rejected',
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextChain(trx));

  expect(claimed).toBeUndefined();
});

test('it skips a chain whose replay frontier is parked', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    startChainIndex: 0,
    status: 'parked',
  });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    startChainIndex: 3,
  });

  const claimed = await ctx.db.transaction().execute((trx) => claimNextChain(trx));

  expect(claimed).toBeUndefined();
});
