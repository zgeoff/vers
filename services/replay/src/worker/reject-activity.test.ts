import { expect, test } from 'bun:test';
import { readActivityStatus, toJSON } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import { readChainAnchors } from '../queue/read-chain-anchors';
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

  const updatedActivity = await readActivityStatus(ctx.db, activity.id);

  const updatedChain = await readChainAnchors(ctx.db, {
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  expect(updatedActivity?.status).toBe('rejected');

  expect(updatedChain).toStrictEqual({
    appendedChainIndex: 3,
    appendedNextSeed: 'aa'.repeat(16),
    verifiedChainIndex: 3,
    verifiedNextSeed: 'aa'.repeat(16),
  });
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

  const updatedActivity = await readActivityStatus(ctx.db, activity.id);

  expect(updatedActivity?.status).toBe('rejected');
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

  const updatedSuccessor = await readActivityStatus(ctx.db, successor.id);

  expect(updatedSuccessor?.status).toBe('rejected');
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

  const updatedSuccessor = await readActivityStatus(ctx.db, successor.id);

  expect(updatedSuccessor?.status).toBe('rejected');
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

  const updatedSuccessor = await readActivityStatus(ctx.db, successor.id);

  expect(updatedSuccessor?.status).toBe('rejected');
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

  const updatedActivity = await readActivityStatus(ctx.db, activity.id);

  const updatedChain = await readChainAnchors(ctx.db, {
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  expect(updatedActivity?.status).toBe('quarantined');

  expect(updatedChain).toStrictEqual({
    appendedChainIndex: chain.appendedChainIndex,
    appendedNextSeed: chain.appendedNextSeed,
    verifiedChainIndex: chain.verifiedChainIndex,
    verifiedNextSeed: chain.verifiedNextSeed,
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

  const updatedUnrelated = await readActivityStatus(ctx.db, unrelated.id);

  expect(updatedUnrelated?.status).toBe('active');
});

test('it moves the verified anchor past the checkpoints a partly proved activity settled before it rewinds', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db, {
    appendedChainIndex: 6,
    appendedNextSeed: 'bb'.repeat(16),
    verifiedChainIndex: 3,
    verifiedNextSeed: 'aa'.repeat(16),
  });

  const activity = await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
    startChainIndex: 3,
    status: 'active',
    verifiedHead: 2,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values({
      activityId: activity.id,
      hash: 'hash-2',
      payload: toJSON({
        chainIndex: 5,
        entropySource: 'server-key',
        nextSeed: 'cc'.repeat(16),
        seed: 'dd'.repeat(16),
        time: 2000,
        type: 'progress',
      }),
      prevHash: 'hash-1',
      version: 2,
    })
    .execute();

  await rejectActivity(ctx.db, {
    activityID: activity.id,
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  const updatedChain = await readChainAnchors(ctx.db, {
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  expect(updatedChain).toStrictEqual({
    appendedChainIndex: 5,
    appendedNextSeed: 'cc'.repeat(16),
    verifiedChainIndex: 5,
    verifiedNextSeed: 'cc'.repeat(16),
  });
});

test('it leaves the verified anchor where it is for an activity proved only to its started checkpoint', async () => {
  await using ctx = await setupTest();

  const chain = await createChainRow(ctx.db, {
    appendedChainIndex: 6,
    appendedNextSeed: 'bb'.repeat(16),
    verifiedChainIndex: 3,
    verifiedNextSeed: 'aa'.repeat(16),
  });

  const activity = await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
    startChainIndex: 3,
    status: 'active',
    verifiedHead: 1,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values({
      activityId: activity.id,
      hash: 'hash-1',
      payload: toJSON({
        chainIndex: 4,
        entropySource: 'server-key',
        nextSeed: 'aa'.repeat(16),
        seed: 'aa'.repeat(16),
        time: 0,
        type: 'started',
      }),
      prevHash: 'start-hash',
      version: 1,
    })
    .execute();

  await rejectActivity(ctx.db, {
    activityID: activity.id,
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  const updatedChain = await readChainAnchors(ctx.db, {
    avatarID: chain.avatarId,
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  expect(updatedChain).toStrictEqual({
    appendedChainIndex: 3,
    appendedNextSeed: expect.any(String),
    verifiedChainIndex: 3,
    verifiedNextSeed: expect.any(String),
  });
});
