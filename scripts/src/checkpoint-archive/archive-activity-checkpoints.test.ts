import { expect, onTestFinished, test } from 'bun:test';
import {
  createActivityRow,
  createAvatarRow,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { S3Client } from 'bun';
import { startStubS3 } from '../test-utils/start-stub-s3';
import { archiveActivityCheckpoints } from './archive-activity-checkpoints';
import { parseCheckpointArchive } from './parse-checkpoint-archive';

async function setupTest(options: Parameters<typeof startStubS3>[0] = {}) {
  const testDB = await createTestDB();

  onTestFinished(() => testDB[Symbol.asyncDispose]());

  const stub = startStubS3(options);

  const bucket = new S3Client({
    accessKeyId: 'stub-access-key',
    bucket: stub.bucket,
    endpoint: stub.endpoint,
    secretAccessKey: 'stub-secret-key',
  });

  return { bucket, db: testDB.db };
}

test('it writes every row of the activity to one gzipped JSON-lines object', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_archive', userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    id: 'act_archive',
    status: 'stopped',
    verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    verifiedHead: 2,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values([
      {
        activityId: 'act_archive',
        appendedAt: new Date('2026-01-01T00:00:01.000Z'),
        hash: 'hash_1',
        payload: { type: 'started' },
        prevHash: 'hash_start',
        version: 1,
      },
      {
        activityId: 'act_archive',
        appendedAt: new Date('2026-01-01T00:00:02.000Z'),
        hash: 'hash_2',
        payload: { type: 'completed' },
        prevHash: 'hash_1',
        version: 2,
      },
    ])
    .execute();

  await archiveActivityCheckpoints(
    ctx,
    { activityID: 'act_archive', appendedHead: 2, avatarID: 'avatar_archive' },
    new Date('2026-01-03T00:00:00.000Z'),
  );

  const archive = await ctx.bucket.file('checkpoints/avatar_archive/act_archive.jsonl.gz').bytes();

  expect(parseCheckpointArchive(archive)).toStrictEqual([
    {
      activityId: 'act_archive',
      appendedAt: new Date('2026-01-01T00:00:01.000Z'),
      hash: 'hash_1',
      payload: { type: 'started' },
      prevHash: 'hash_start',
      version: 1,
    },
    {
      activityId: 'act_archive',
      appendedAt: new Date('2026-01-01T00:00:02.000Z'),
      hash: 'hash_2',
      payload: { type: 'completed' },
      prevHash: 'hash_1',
      version: 2,
    },
  ]);
});

test('it deletes every row below the tail and keeps the tail row', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: avatar.id,
    id: 'act_tail',
    status: 'stopped',
    verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    verifiedHead: 3,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values([
      { activityId: 'act_tail', hash: 'hash_1', payload: {}, prevHash: 'hash_0', version: 1 },
      { activityId: 'act_tail', hash: 'hash_2', payload: {}, prevHash: 'hash_1', version: 2 },
      { activityId: 'act_tail', hash: 'hash_3', payload: {}, prevHash: 'hash_2', version: 3 },
    ])
    .execute();

  const outcome = await archiveActivityCheckpoints(
    ctx,
    { activityID: 'act_tail', appendedHead: 3, avatarID: avatar.id },
    new Date('2026-01-03T00:00:00.000Z'),
  );

  const remaining = await ctx.db
    .selectFrom('activityCheckpoints')
    .select('version')
    .where('activityId', '=', 'act_tail')
    .execute();

  expect(outcome).toStrictEqual({ archivedRows: 3, deletedRows: 2, kind: 'archived' });
  expect(remaining).toStrictEqual([{ version: 3 }]);
});

test('it stamps the head row with the archive time', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 1,
    avatarId: avatar.id,
    id: 'act_stamp',
    status: 'capped',
    verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    verifiedHead: 1,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values({
      activityId: 'act_stamp',
      hash: 'hash_1',
      payload: {},
      prevHash: 'hash_0',
      version: 1,
    })
    .execute();

  await archiveActivityCheckpoints(
    ctx,
    { activityID: 'act_stamp', appendedHead: 1, avatarID: avatar.id },
    new Date('2026-01-03T00:00:00.000Z'),
  );

  const head = await ctx.db
    .selectFrom('activities')
    .select('archivedAt')
    .where('id', '=', 'act_stamp')
    .executeTakeFirstOrThrow();

  expect(head.archivedAt).toStrictEqual(new Date('2026-01-03T00:00:00.000Z'));
});

test('it keeps every row and leaves the head unstamped when the read-back differs', async () => {
  const ctx = await setupTest({ corruptStoredBodies: true });
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    id: 'act_corrupt',
    status: 'stopped',
    verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    verifiedHead: 2,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values([
      { activityId: 'act_corrupt', hash: 'hash_1', payload: {}, prevHash: 'hash_0', version: 1 },
      { activityId: 'act_corrupt', hash: 'hash_2', payload: {}, prevHash: 'hash_1', version: 2 },
    ])
    .execute();

  const failure = await archiveActivityCheckpoints(
    ctx,
    { activityID: 'act_corrupt', appendedHead: 2, avatarID: avatar.id },
    new Date('2026-01-03T00:00:00.000Z'),
  ).then(
    () => null,
    (error: unknown) => error,
  );

  const remaining = await ctx.db
    .selectFrom('activityCheckpoints')
    .select('version')
    .where('activityId', '=', 'act_corrupt')
    .orderBy('version')
    .execute();

  const head = await ctx.db
    .selectFrom('activities')
    .select('archivedAt')
    .where('id', '=', 'act_corrupt')
    .executeTakeFirstOrThrow();

  expect(failure).toBeInstanceOf(Error);
  expect(remaining).toStrictEqual([{ version: 1 }, { version: 2 }]);
  expect(head).toStrictEqual({ archivedAt: null });
});

test('it deletes nothing when the head moved after it was selected', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    id: 'act_moved',
    status: 'stopped',
    verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    verifiedHead: 2,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values([
      { activityId: 'act_moved', hash: 'hash_1', payload: {}, prevHash: 'hash_0', version: 1 },
      { activityId: 'act_moved', hash: 'hash_2', payload: {}, prevHash: 'hash_1', version: 2 },
    ])
    .execute();

  const outcome = await archiveActivityCheckpoints(
    ctx,
    { activityID: 'act_moved', appendedHead: 1, avatarID: avatar.id },
    new Date('2026-01-03T00:00:00.000Z'),
  );

  const remaining = await ctx.db
    .selectFrom('activityCheckpoints')
    .select('version')
    .where('activityId', '=', 'act_moved')
    .orderBy('version')
    .execute();

  expect(outcome).toStrictEqual({ kind: 'changed' });
  expect(remaining).toStrictEqual([{ version: 1 }, { version: 2 }]);
});
