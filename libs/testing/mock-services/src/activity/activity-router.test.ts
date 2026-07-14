import { expect, test } from 'bun:test';
import { call } from '@orpc/server';
import { createId } from '@paralleldrive/cuid2';
import * as db from '../db';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { activityRouter } from './activity-router';

test('#startActivity it starts an active activity snapshotting the avatar build', async () => {
  const userID = createId();

  const avatar = await db.avatarCollection.create({ level: 4, userID, xp: 120 });

  const activity = await call(
    activityRouter.startActivity,
    { avatarID: avatar.id, scopeID: 'node-1', scopeType: 'node' },
    { context: { actingUserId: userID } },
  );

  expect(activity).toMatchObject({
    appendedHead: 0,
    avatarID: avatar.id,
    buildSnapshot: { level: 4, xp: 120 },
    status: 'active',
    verifiedHead: 0,
  });

  expect(activity.lastHash).toBe(activity.startHash);
});

test('#startActivity it rejects an anonymous caller', () => {
  expect(
    call(
      activityRouter.startActivity,
      { avatarID: createId(), scopeID: 'node-1', scopeType: 'node' },
      { context: { actingUserId: null } },
    ),
  ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
});

test("#startActivity it rejects an avatar the caller doesn't own", async () => {
  const avatar = await db.avatarCollection.create({});

  expect(
    call(
      activityRouter.startActivity,
      { avatarID: avatar.id, scopeID: 'node-1', scopeType: 'node' },
      { context: { actingUserId: createId() } },
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('#startActivity it reports the already-active activity as a conflict', async () => {
  const userID = createId();

  const avatar = await db.avatarCollection.create({ userID });

  const first = await call(
    activityRouter.startActivity,
    { avatarID: avatar.id, scopeID: 'node-1', scopeType: 'node' },
    { context: { actingUserId: userID } },
  );

  expect(
    call(
      activityRouter.startActivity,
      { avatarID: avatar.id, scopeID: 'node-2', scopeType: 'node' },
      { context: { actingUserId: userID } },
    ),
  ).rejects.toMatchObject({ code: 'CONFLICT', data: { activity: { id: first.id } } });
});

test('#startActivity it refuses a start on a quarantined chain', async () => {
  const userID = createId();

  const avatar = await db.avatarCollection.create({ userID });

  await db.activityCollection.create({
    avatarID: avatar.id,
    scopeID: 'node-q',
    scopeType: 'node',
    status: 'quarantined',
  });

  expect(
    call(
      activityRouter.startActivity,
      { avatarID: avatar.id, scopeID: 'node-q', scopeType: 'node' },
      { context: { actingUserId: userID } },
    ),
  ).rejects.toMatchObject({ code: 'CHAIN_QUARANTINED' });
});

test('#getCurrentActivity it returns null when the avatar has no active activity', async () => {
  const userID = createId();

  const avatar = await db.avatarCollection.create({ userID });

  const result = await call(
    activityRouter.getCurrentActivity,
    { avatarID: avatar.id },
    { context: { actingUserId: userID } },
  );

  expect(result).toBeNull();
});

test('#getCurrentActivity it returns the active activity', async () => {
  const userID = createId();

  const avatar = await db.avatarCollection.create({ userID });
  const activity = await db.activityCollection.create({ avatarID: avatar.id });

  const result = await call(
    activityRouter.getCurrentActivity,
    { avatarID: avatar.id },
    { context: { actingUserId: userID } },
  );

  expect(result).toMatchObject({ id: activity.id });
});

test("#getLatestActivityProgress it rejects an avatar the caller doesn't own", async () => {
  const avatar = await db.avatarCollection.create({});

  expect(
    call(
      activityRouter.getLatestActivityProgress,
      { avatarID: avatar.id },
      { context: { actingUserId: createId() } },
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('#getLatestActivityProgress it rejects when no activity exists for the avatar', async () => {
  const userID = createId();

  const avatar = await db.avatarCollection.create({ userID });

  expect(
    call(
      activityRouter.getLatestActivityProgress,
      { avatarID: avatar.id },
      { context: { actingUserId: userID } },
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('#getLatestActivityProgress it returns the latest activity with a null anchor before verification', async () => {
  const userID = createId();

  const avatar = await db.avatarCollection.create({ userID });

  await db.activityCollection.create({
    avatarID: avatar.id,
    startedAt: new Date('2026-01-01'),
    status: 'stopped',
  });

  const latest = await db.activityCollection.create({
    avatarID: avatar.id,
    startedAt: new Date('2026-02-01'),
  });

  const result = await call(
    activityRouter.getLatestActivityProgress,
    { avatarID: avatar.id },
    { context: { actingUserId: userID } },
  );

  expect(result).toMatchObject({
    activity: { id: latest.id },
    anchor: null,
    appendedHead: latest.appendedHead,
    verifiedHead: 0,
  });

  expect(result.serverTime).toBeValidDate();
});

test('#getLatestActivityProgress it anchors on the verified-head checkpoint', async () => {
  const userID = createId();

  const avatar = await db.avatarCollection.create({ userID });

  const activity = await db.activityCollection.create({
    avatarID: avatar.id,
    appendedHead: 3,
    verifiedHead: 2,
  });

  const anchor = await db.checkpointCollection.create({ activityID: activity.id, version: 2 });

  const result = await call(
    activityRouter.getLatestActivityProgress,
    { avatarID: avatar.id },
    { context: { actingUserId: userID } },
  );

  expect(result.anchor).toMatchObject({ hash: anchor.hash, version: 2 });
});

test('#trackActivityProgress it appends a batch and advances the head', async () => {
  const userID = createId();

  const avatar = await db.avatarCollection.create({ userID });
  const activity = await db.activityCollection.create({ appendedHead: 2, avatarID: avatar.id });

  const checkpoint = createMockCheckpointBatchEntry({ version: 3 });

  const result = await call(
    activityRouter.trackActivityProgress,
    { activityID: activity.id, checkpoints: [checkpoint], expectedHead: 2 },
    { context: { actingUserId: userID } },
  );

  expect(result).toStrictEqual({ appendedHead: 3 });

  const updated = db.activityCollection.findFirst((q) => q.where({ id: activity.id }));

  expect(updated).toMatchObject({ appendedHead: 3, lastHash: checkpoint.hash });

  const stored = db.checkpointCollection.findFirst((q) =>
    q.where({ activityID: activity.id, version: 3 }),
  );

  expect(stored).toMatchObject({ hash: checkpoint.hash });
});

test('#trackActivityProgress it rejects a stale head as a retryable conflict', async () => {
  const userID = createId();

  const avatar = await db.avatarCollection.create({ userID });
  const activity = await db.activityCollection.create({ appendedHead: 5, avatarID: avatar.id });

  expect(
    call(
      activityRouter.trackActivityProgress,
      {
        activityID: activity.id,
        checkpoints: [createMockCheckpointBatchEntry({ version: 3 })],
        expectedHead: 2,
      },
      { context: { actingUserId: userID } },
    ),
  ).rejects.toMatchObject({ code: 'CONFLICT', data: { appendedHead: 5 } });
});

test("#trackActivityProgress it rejects an activity whose avatar the caller doesn't own", async () => {
  const activity = await db.activityCollection.create({});

  expect(
    call(
      activityRouter.trackActivityProgress,
      {
        activityID: activity.id,
        checkpoints: [createMockCheckpointBatchEntry()],
        expectedHead: 0,
      },
      { context: { actingUserId: createId() } },
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('#trackActivityProgress it refuses appends once the activity is terminal', async () => {
  const userID = createId();

  const avatar = await db.avatarCollection.create({ userID });

  const activity = await db.activityCollection.create({
    appendedHead: 4,
    avatarID: avatar.id,
    status: 'stopped',
  });

  expect(
    call(
      activityRouter.trackActivityProgress,
      {
        activityID: activity.id,
        checkpoints: [createMockCheckpointBatchEntry({ version: 5 })],
        expectedHead: 4,
      },
      { context: { actingUserId: userID } },
    ),
  ).rejects.toMatchObject({
    code: 'ACTIVITY_TERMINAL',
    data: { appendedHead: 4, status: 'stopped' },
  });
});

test('#trackActivityProgress it rejects an unknown activity', () => {
  expect(
    call(
      activityRouter.trackActivityProgress,
      { activityID: createId(), checkpoints: [createMockCheckpointBatchEntry()], expectedHead: 0 },
      { context: { actingUserId: createId() } },
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('#stopActivity it stops the active activity', async () => {
  const userID = createId();

  const avatar = await db.avatarCollection.create({ userID });

  await db.activityCollection.create({ avatarID: avatar.id });

  const stopped = await call(
    activityRouter.stopActivity,
    { avatarID: avatar.id },
    { context: { actingUserId: userID } },
  );

  expect(stopped).toMatchObject({ status: 'stopped' });
  expect(stopped.stoppedAt).toBeValidDate();
});

test("#stopActivity it rejects an avatar the caller doesn't own", async () => {
  const avatar = await db.avatarCollection.create({});

  await db.activityCollection.create({ avatarID: avatar.id });

  expect(
    call(
      activityRouter.stopActivity,
      { avatarID: avatar.id },
      { context: { actingUserId: createId() } },
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('#stopActivity it rejects when nothing is active', async () => {
  const userID = createId();

  const avatar = await db.avatarCollection.create({ userID });

  expect(
    call(
      activityRouter.stopActivity,
      { avatarID: avatar.id },
      { context: { actingUserId: userID } },
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('#resumeActivity it returns the active activity', async () => {
  const userID = createId();

  const avatar = await db.avatarCollection.create({ userID });
  const activity = await db.activityCollection.create({ avatarID: avatar.id });

  const resumed = await call(
    activityRouter.resumeActivity,
    { activityID: activity.id },
    { context: { actingUserId: userID } },
  );

  expect(resumed).toMatchObject({ id: activity.id });
});

test("#resumeActivity it rejects an activity whose avatar the caller doesn't own", async () => {
  const activity = await db.activityCollection.create({});

  expect(
    call(
      activityRouter.resumeActivity,
      { activityID: activity.id },
      { context: { actingUserId: createId() } },
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('#resumeActivity it rejects a stopped activity', async () => {
  const activity = await db.activityCollection.create({ status: 'stopped' });

  expect(
    call(
      activityRouter.resumeActivity,
      { activityID: activity.id },
      { context: { actingUserId: createId() } },
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});
