import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createActivityRow } from '../test-utils/create-activity-row';
import { createChainRow } from '../test-utils/create-chain-row';
import { findReplayFrontier } from './find-replay-frontier';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns the oldest pending activity on the chain', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  const chainKey = {
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  };

  const older = await createActivityRow(ctx.db, {
    appendedHead: 4,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    startChainIndex: 0,
    status: 'stopped',
    verifiedHead: 2,
  });

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    startChainIndex: 4,
  });

  const frontier = await findReplayFrontier(ctx.db, chainKey);

  expect(frontier).toStrictEqual({
    activityID: older.id,
    appendedHead: 4,
    replayAttempts: 0,
    startChainIndex: 0,
    status: 'stopped',
    verifiedHead: 2,
  });
});

test('it skips a rejected activity and returns the honest activity behind it', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  const chainKey = {
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  };

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    startChainIndex: 0,
    status: 'rejected',
  });

  const honest = await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    startChainIndex: 3,
    status: 'active',
  });

  const frontier = await findReplayFrontier(ctx.db, chainKey);

  expect(frontier).toStrictEqual({
    activityID: honest.id,
    appendedHead: 2,
    replayAttempts: 0,
    startChainIndex: 3,
    status: 'active',
    verifiedHead: 0,
  });
});

test('it reports a chain with only a rejected activity as fully replayed', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    status: 'rejected',
  });

  const frontier = await findReplayFrontier(ctx.db, {
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  expect(frontier).toBeUndefined();
});

test('it reports a fully replayed chain as undefined', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    verifiedHead: 3,
  });

  const frontier = await findReplayFrontier(ctx.db, {
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  expect(frontier).toBeUndefined();
});
