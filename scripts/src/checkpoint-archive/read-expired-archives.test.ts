import { expect, onTestFinished, test } from 'bun:test';
import {
  createActivityRow,
  createAvatarRow,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { S3Client } from 'bun';
import { startStubS3 } from '../test-utils/start-stub-s3';
import { readExpiredArchives } from './read-expired-archives';

async function setupTest() {
  const testDB = await createTestDB();

  onTestFinished(() => testDB[Symbol.asyncDispose]());

  const stub = startStubS3({ pageSize: 1 });

  const bucket = new S3Client({
    accessKeyId: 'stub-access-key',
    bucket: stub.bucket,
    endpoint: stub.endpoint,
    secretAccessKey: 'stub-secret-key',
  });

  return { bucket, db: testDB.db };
}

test('it reads the expired archives of stamped activities across every listing page', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_pages', userId: user.user.id });

  await createActivityRow(ctx.db, {
    archivedAt: new Date(),
    avatarId: avatar.id,
    id: 'act_page_a',
    status: 'stopped',
  });

  await createActivityRow(ctx.db, {
    archivedAt: new Date(),
    avatarId: avatar.id,
    id: 'act_page_b',
    status: 'stopped',
  });

  await createActivityRow(ctx.db, { avatarId: avatar.id, id: 'act_page_c', status: 'stopped' });

  await ctx.bucket.write('checkpoints/avatar_pages/act_page_a.jsonl.gz', 'rows');
  await ctx.bucket.write('checkpoints/avatar_pages/act_page_b.jsonl.gz', 'rows');
  await ctx.bucket.write('checkpoints/avatar_pages/act_page_c.jsonl.gz', 'rows');

  const archives = await readExpiredArchives(ctx, new Date(Date.now() + 60_000));

  expect(archives).toStrictEqual([
    { activityID: 'act_page_a', key: 'checkpoints/avatar_pages/act_page_a.jsonl.gz' },
    { activityID: 'act_page_b', key: 'checkpoints/avatar_pages/act_page_b.jsonl.gz' },
  ]);
});

test('it reads the expired archive of an activity whose head row is gone', async () => {
  const ctx = await setupTest();

  await ctx.bucket.write('checkpoints/avatar_gone/act_gone.jsonl.gz', 'rows');

  const archives = await readExpiredArchives(ctx, new Date(Date.now() + 60_000));

  expect(archives).toStrictEqual([
    { activityID: 'act_gone', key: 'checkpoints/avatar_gone/act_gone.jsonl.gz' },
  ]);
});

test('it reads no archive of an activity whose head row has no stamp', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_live', userId: user.user.id });

  await createActivityRow(ctx.db, { avatarId: avatar.id, id: 'act_live', status: 'stopped' });

  await ctx.bucket.write('checkpoints/avatar_live/act_live.jsonl.gz', 'rows');

  const archives = await readExpiredArchives(ctx, new Date(Date.now() + 60_000));

  expect(archives).toStrictEqual([]);
});
