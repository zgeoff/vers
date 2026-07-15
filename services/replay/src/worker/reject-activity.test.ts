import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createActivityRow } from '../test-utils/create-activity-row';
import { createChainRow } from '../test-utils/create-chain-row';
import { rejectActivity } from './reject-activity';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it rejects an active activity and rewinds the chain appended anchor to the verified anchor', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db, {
    appendedChainIndex: 6,
    appendedNextSeed: 'bb'.repeat(16),
    verifiedChainIndex: 3,
    verifiedNextSeed: 'aa'.repeat(16),
  });

  const activity = await createActivityRow(ctx.db, {
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
    startChainIndex: 3,
    status: 'active',
  });

  await rejectActivity(ctx.db, {
    activityID: activity.id,
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  const updatedActivity = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  const updatedChain = await ctx.db
    .selectFrom('activityChains')
    .select(['appendedChainIndex', 'appendedNextSeed'])
    .where('avatarId', '=', chain.avatarId)
    .where('scopeId', '=', chain.scopeId)
    .executeTakeFirstOrThrow();

  expect(updatedActivity.status).toBe('rejected');
  expect(updatedChain).toStrictEqual({ appendedChainIndex: 3, appendedNextSeed: 'aa'.repeat(16) });
});

test('it rejects an activity already forward-exited to stopped', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db);

  const activity = await createActivityRow(ctx.db, {
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
    status: 'stopped',
  });

  await rejectActivity(ctx.db, {
    activityID: activity.id,
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  const updatedActivity = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  expect(updatedActivity.status).toBe('rejected');
});

test('it voids an active successor rooted past the verified point', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db, {
    verifiedChainIndex: 2,
    verifiedNextSeed: 'aa'.repeat(16),
  });

  const activity = await createActivityRow(ctx.db, {
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
    startChainIndex: 2,
    status: 'stopped',
  });

  const successor = await createActivityRow(ctx.db, {
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
    startChainIndex: 5,
    status: 'active',
  });

  await rejectActivity(ctx.db, {
    activityID: activity.id,
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  const updatedSuccessor = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', successor.id)
    .executeTakeFirstOrThrow();

  expect(updatedSuccessor.status).toBe('rejected');
});

test('it voids a stopped successor rooted past the verified point', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db, {
    verifiedChainIndex: 2,
    verifiedNextSeed: 'aa'.repeat(16),
  });

  const activity = await createActivityRow(ctx.db, {
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
    startChainIndex: 2,
    status: 'stopped',
  });

  const successor = await createActivityRow(ctx.db, {
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
    startChainIndex: 5,
    status: 'stopped',
  });

  await rejectActivity(ctx.db, {
    activityID: activity.id,
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  const updatedSuccessor = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', successor.id)
    .executeTakeFirstOrThrow();

  expect(updatedSuccessor.status).toBe('rejected');
});

test('it voids a capped successor rooted past the verified point', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db, {
    verifiedChainIndex: 2,
    verifiedNextSeed: 'aa'.repeat(16),
  });

  const activity = await createActivityRow(ctx.db, {
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
    startChainIndex: 2,
    status: 'stopped',
  });

  const successor = await createActivityRow(ctx.db, {
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
    startChainIndex: 5,
    status: 'capped',
  });

  await rejectActivity(ctx.db, {
    activityID: activity.id,
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  const updatedSuccessor = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', successor.id)
    .executeTakeFirstOrThrow();

  expect(updatedSuccessor.status).toBe('rejected');
});

test('it writes nothing for a stale call whose target activity already changed status', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db, {
    appendedChainIndex: 6,
    appendedNextSeed: 'bb'.repeat(16),
    verifiedChainIndex: 3,
    verifiedNextSeed: 'aa'.repeat(16),
  });

  const activity = await createActivityRow(ctx.db, {
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
    startChainIndex: 3,
    status: 'quarantined',
  });

  const result = await rejectActivity(ctx.db, {
    activityID: activity.id,
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  expect(result).toStrictEqual({ applied: false });

  const updatedActivity = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', activity.id)
    .executeTakeFirstOrThrow();

  const updatedChain = await ctx.db
    .selectFrom('activityChains')
    .select(['appendedChainIndex', 'appendedNextSeed'])
    .where('avatarId', '=', chain.avatarId)
    .where('scopeId', '=', chain.scopeId)
    .executeTakeFirstOrThrow();

  expect(updatedActivity.status).toBe('quarantined');

  expect(updatedChain).toStrictEqual({
    appendedChainIndex: chain.appendedChainIndex,
    appendedNextSeed: chain.appendedNextSeed,
  });
});

test('it leaves an active successor untouched when it is rooted at or before the verified point', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db, {
    verifiedChainIndex: 5,
    verifiedNextSeed: 'aa'.repeat(16),
  });

  const activity = await createActivityRow(ctx.db, {
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
    startChainIndex: 2,
    status: 'stopped',
  });

  const unrelated = await createActivityRow(ctx.db, {
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
    startChainIndex: 5,
    status: 'active',
  });

  await rejectActivity(ctx.db, {
    activityID: activity.id,
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  const updatedUnrelated = await ctx.db
    .selectFrom('activities')
    .select('status')
    .where('id', '=', unrelated.id)
    .executeTakeFirstOrThrow();

  expect(updatedUnrelated.status).toBe('active');
});
