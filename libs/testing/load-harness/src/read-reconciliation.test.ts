import { expect, onTestFinished, test } from 'bun:test';
import { ActivityFailureAction, buildXPThreshold } from '@vers/idle-core';
import { createActivityRow, createTestDB } from '@vers/service-test-utils/bun';
import invariant from 'tiny-invariant';
import { readReconciliation } from './read-reconciliation';
import { writePlayerAccounts } from './write-player-accounts';

async function setupTest() {
  const testDB = await createTestDB({ isolation: 'schema' });

  onTestFinished(() => testDB[Symbol.asyncDispose]());

  return { db: testDB.db };
}

test('it counts the unproved checkpoints and the held activities', async () => {
  const ctx = await setupTest();

  const accounts = await writePlayerAccounts(
    ctx.db,
    [{ failureAction: ActivityFailureAction.Retry, index: 0, level: 1, simVersion: 'engine-a' }],
    'run1',
  );

  const [account] = accounts;

  invariant(account !== undefined);

  await createActivityRow(ctx.db, {
    appendedHead: 4,
    appendedTimeMs: 40_000,
    avatarId: account.avatarID,
    verifiedHead: 1,
  });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    appendedTimeMs: 20_000,
    avatarId: account.avatarID,
    status: 'parked',
    verifiedHead: 2,
  });

  const reconciliation = await readReconciliation(ctx.db, accounts, new Map());

  expect(reconciliation).toMatchObject({
    activities: 2,
    checkpoints: 6,
    held: 1,
    simulatedMs: 60_000,
    unverified: 3,
  });
});

test('it counts each avatar whose XP differs from its seeded XP plus what it settled', async () => {
  const ctx = await setupTest();

  const accounts = await writePlayerAccounts(
    ctx.db,
    [
      { failureAction: ActivityFailureAction.Retry, index: 0, level: 3, simVersion: 'engine-a' },
      { failureAction: ActivityFailureAction.Retry, index: 1, level: 3, simVersion: 'engine-a' },
    ],
    'run2',
  );

  const [paid, unpaid] = accounts;

  invariant(paid !== undefined && unpaid !== undefined);

  await createActivityRow(ctx.db, { avatarId: paid.avatarID, settledXp: 50 });
  await createActivityRow(ctx.db, { avatarId: unpaid.avatarID, settledXp: 50 });

  await ctx.db
    .updateTable('avatars')
    .set({ xp: buildXPThreshold(3) + 50 })
    .where('id', '=', paid.avatarID)
    .execute();

  const reconciliation = await readReconciliation(ctx.db, accounts, new Map());

  expect(reconciliation.avatarXPMismatches).toBe(1);
});

test('it counts each delivered run that settled at other XP than its stream earned', async () => {
  const ctx = await setupTest();

  const accounts = await writePlayerAccounts(
    ctx.db,
    [{ failureAction: ActivityFailureAction.Retry, index: 0, level: 1, simVersion: 'engine-a' }],
    'run3',
  );

  const [account] = accounts;

  invariant(account !== undefined);

  const matched = await createActivityRow(ctx.db, {
    avatarId: account.avatarID,
    settledXp: 30,
    status: 'stopped',
  });

  const short = await createActivityRow(ctx.db, {
    avatarId: account.avatarID,
    settledXp: 10,
    status: 'stopped',
  });

  const reconciliation = await readReconciliation(
    ctx.db,
    accounts,
    new Map([
      [matched.id, 30],
      [short.id, 25],
    ]),
  );

  expect(reconciliation.runXPMismatches).toBe(1);
});

test('it counts the terminal checkpoints by how each attempt ended', async () => {
  const ctx = await setupTest();

  const accounts = await writePlayerAccounts(
    ctx.db,
    [{ failureAction: ActivityFailureAction.Retry, index: 0, level: 1, simVersion: 'engine-a' }],
    'run4',
  );

  const [account] = accounts;

  invariant(account !== undefined);

  const won = await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: account.avatarID,
    status: 'stopped',
  });

  const lost = await createActivityRow(ctx.db, {
    appendedHead: 1,
    avatarId: account.avatarID,
    status: 'stopped',
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values([
      { activityId: won.id, hash: 'h1', payload: { type: 'progress' }, prevHash: 'h0', version: 1 },
      {
        activityId: won.id,
        hash: 'h2',
        payload: { type: 'completed' },
        prevHash: 'h1',
        version: 2,
      },
      { activityId: lost.id, hash: 'h3', payload: { type: 'failed' }, prevHash: 'h0', version: 1 },
    ])
    .execute();

  const reconciliation = await readReconciliation(ctx.db, accounts, new Map());

  expect(reconciliation.outcomes).toStrictEqual({ completed: 1, failed: 1 });
});
