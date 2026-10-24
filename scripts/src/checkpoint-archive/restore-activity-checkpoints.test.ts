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
import { restoreActivityCheckpoints } from './restore-activity-checkpoints';

async function setupTest() {
  const testDB = await createTestDB();

  onTestFinished(() => testDB[Symbol.asyncDispose]());

  const stub = startStubS3();

  const bucket = new S3Client({
    accessKeyId: 'stub-access-key',
    bucket: stub.bucket,
    endpoint: stub.endpoint,
    secretAccessKey: 'stub-secret-key',
  });

  return { bucket, db: testDB.db };
}

test('it reinserts the archived rows of one activity from its archive', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: avatar.id,
    id: 'act_restore',
    status: 'stopped',
    verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    verifiedHead: 3,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values([
      {
        activityId: 'act_restore',
        appendedAt: new Date('2026-01-01T00:00:01.000Z'),
        hash: 'hash_1',
        payload: { type: 'started' },
        prevHash: 'hash_0',
        version: 1,
      },
      {
        activityId: 'act_restore',
        appendedAt: new Date('2026-01-01T00:00:02.000Z'),
        hash: 'hash_2',
        payload: { rewards: { xp: 4 }, type: 'progress' },
        prevHash: 'hash_1',
        version: 2,
      },
      {
        activityId: 'act_restore',
        appendedAt: new Date('2026-01-01T00:00:03.000Z'),
        hash: 'hash_3',
        payload: { type: 'completed' },
        prevHash: 'hash_2',
        version: 3,
      },
    ])
    .execute();

  await archiveActivityCheckpoints(
    ctx,
    { activityID: 'act_restore', appendedHead: 3, avatarID: avatar.id },
    new Date('2026-01-03T00:00:00.000Z'),
  );

  const outcome = await restoreActivityCheckpoints(ctx, 'act_restore');

  const rows = await ctx.db
    .selectFrom('activityCheckpoints')
    .selectAll()
    .where('activityId', '=', 'act_restore')
    .orderBy('version')
    .execute();

  expect(outcome).toStrictEqual({ kind: 'restored', restoredRows: 2 });

  expect(rows).toStrictEqual([
    {
      activityId: 'act_restore',
      appendedAt: new Date('2026-01-01T00:00:01.000Z'),
      hash: 'hash_1',
      payload: { type: 'started' },
      prevHash: 'hash_0',
      version: 1,
    },
    {
      activityId: 'act_restore',
      appendedAt: new Date('2026-01-01T00:00:02.000Z'),
      hash: 'hash_2',
      payload: { rewards: { xp: 4 }, type: 'progress' },
      prevHash: 'hash_1',
      version: 2,
    },
    {
      activityId: 'act_restore',
      appendedAt: new Date('2026-01-01T00:00:03.000Z'),
      hash: 'hash_3',
      payload: { type: 'completed' },
      prevHash: 'hash_2',
      version: 3,
    },
  ]);
});

test('it clears the archive stamp of a restored activity', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    id: 'act_unstamp',
    status: 'stopped',
    verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    verifiedHead: 2,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values([
      { activityId: 'act_unstamp', hash: 'hash_1', payload: {}, prevHash: 'hash_0', version: 1 },
      { activityId: 'act_unstamp', hash: 'hash_2', payload: {}, prevHash: 'hash_1', version: 2 },
    ])
    .execute();

  await archiveActivityCheckpoints(
    ctx,
    { activityID: 'act_unstamp', appendedHead: 2, avatarID: avatar.id },
    new Date('2026-01-03T00:00:00.000Z'),
  );

  await restoreActivityCheckpoints(ctx, 'act_unstamp');

  const head = await ctx.db
    .selectFrom('activities')
    .select('archivedAt')
    .where('id', '=', 'act_unstamp')
    .executeTakeFirstOrThrow();

  expect(head.archivedAt).toBeNull();
});

test('it reports an activity with no archive', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_unarchived', userId: user.user.id });

  await createActivityRow(ctx.db, { avatarId: avatar.id, id: 'act_unarchived' });

  const outcome = await restoreActivityCheckpoints(ctx, 'act_unarchived');

  expect(outcome).toStrictEqual({
    key: 'checkpoints/avatar_unarchived/act_unarchived.jsonl.gz',
    kind: 'missing-archive',
  });
});

test('it reports an activity id with no head row', async () => {
  const ctx = await setupTest();
  const outcome = await restoreActivityCheckpoints(ctx, 'act_unknown');

  expect(outcome).toStrictEqual({ kind: 'missing-activity' });
});
