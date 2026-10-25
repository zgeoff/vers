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
import { readExpiredArchives } from './read-expired-archives';
import { removeExpiredArchives } from './remove-expired-archives';
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

  return { bucket, db: testDB.db, stub };
}

test('it removes an archive whose stamp and write time are both before the cutoff', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_remove', userId: user.user.id });

  await createActivityRow(ctx.db, {
    archivedAt: new Date('2026-01-01T00:00:00.000Z'),
    avatarId: avatar.id,
    id: 'act_remove',
    status: 'stopped',
  });

  await ctx.bucket.write('checkpoints/avatar_remove/act_remove.jsonl.gz', 'rows');

  ctx.stub.setLastModified(
    'checkpoints/avatar_remove/act_remove.jsonl.gz',
    new Date('2026-01-01T00:00:00.000Z'),
  );

  const removed = await removeExpiredArchives(
    ctx,
    [{ activityID: 'act_remove', key: 'checkpoints/avatar_remove/act_remove.jsonl.gz' }],
    new Date('2026-04-01T00:00:00.000Z'),
  );

  const exists = await ctx.bucket.exists('checkpoints/avatar_remove/act_remove.jsonl.gz');

  expect(removed).toBe(1);
  expect(exists).toBeFalse();
});

test('it removes an archive written before the cutoff whose activity row is gone', async () => {
  const ctx = await setupTest();

  await ctx.bucket.write('checkpoints/avatar_deleted/act_orphan.jsonl.gz', 'rows');

  ctx.stub.setLastModified(
    'checkpoints/avatar_deleted/act_orphan.jsonl.gz',
    new Date('2026-01-01T00:00:00.000Z'),
  );

  const removed = await removeExpiredArchives(
    ctx,
    [{ activityID: 'act_orphan', key: 'checkpoints/avatar_deleted/act_orphan.jsonl.gz' }],
    new Date('2026-04-01T00:00:00.000Z'),
  );

  const exists = await ctx.bucket.exists('checkpoints/avatar_deleted/act_orphan.jsonl.gz');

  expect(removed).toBe(1);
  expect(exists).toBeFalse();
});

test('it keeps an archive written again after a stale listing', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_rewritten', userId: user.user.id });

  const writtenBefore = new Date(Date.now() - 7_776_000_000);

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    id: 'act_rewritten',
    status: 'stopped',
    verifiedAt: new Date(Date.now() - 8_640_000_000),
    verifiedHead: 2,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values([
      { activityId: 'act_rewritten', hash: 'hash_1', payload: {}, prevHash: 'hash_0', version: 1 },
      { activityId: 'act_rewritten', hash: 'hash_2', payload: {}, prevHash: 'hash_1', version: 2 },
    ])
    .execute();

  await archiveActivityCheckpoints(
    ctx,
    { activityID: 'act_rewritten', appendedHead: 2, avatarID: avatar.id },
    new Date(Date.now() - 8_553_600_000),
  );

  ctx.stub.setLastModified(
    'checkpoints/avatar_rewritten/act_rewritten.jsonl.gz',
    new Date(Date.now() - 8_553_600_000),
  );

  const staleListing = await readExpiredArchives(ctx, writtenBefore);

  await restoreActivityCheckpoints(ctx, 'act_rewritten');

  await archiveActivityCheckpoints(
    ctx,
    { activityID: 'act_rewritten', appendedHead: 2, avatarID: avatar.id },
    new Date(),
  );

  const removed = await removeExpiredArchives(ctx, staleListing, writtenBefore);

  const archive = await ctx.bucket
    .file('checkpoints/avatar_rewritten/act_rewritten.jsonl.gz')
    .bytes();

  expect(staleListing).toStrictEqual([
    { activityID: 'act_rewritten', key: 'checkpoints/avatar_rewritten/act_rewritten.jsonl.gz' },
  ]);

  expect(removed).toBe(0);
  expect(parseCheckpointArchive(archive).map((row) => row.version)).toStrictEqual([1, 2]);
});
