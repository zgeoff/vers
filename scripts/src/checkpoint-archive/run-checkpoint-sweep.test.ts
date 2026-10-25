import { expect, onTestFinished, test } from 'bun:test';
import {
  createActivityRow,
  createAvatarRow,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { S3Client } from 'bun';
import { startStubS3 } from '../test-utils/start-stub-s3';
import { parseCheckpointArchive } from './parse-checkpoint-archive';
import { runCheckpointSweep } from './run-checkpoint-sweep';

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

test('it archives an activity verified more than 24 hours ago and deletes its rows below the tail', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_sweep', userId: user.user.id });

  const now = new Date();

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    id: 'act_sweep',
    status: 'stopped',
    verifiedAt: new Date(now.getTime() - 86_400_000 - 1000),
    verifiedHead: 2,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values([
      {
        activityId: 'act_sweep',
        appendedAt: new Date('2026-01-01T00:00:01.000Z'),
        hash: 'hash_1',
        payload: {},
        prevHash: 'hash_0',
        version: 1,
      },
      {
        activityId: 'act_sweep',
        appendedAt: new Date('2026-01-01T00:00:02.000Z'),
        hash: 'hash_2',
        payload: {},
        prevHash: 'hash_1',
        version: 2,
      },
    ])
    .execute();

  const summary = await runCheckpointSweep(ctx, { apply: true, limit: 10, now });
  const archive = await ctx.bucket.file('checkpoints/avatar_sweep/act_sweep.jsonl.gz').bytes();

  const remaining = await ctx.db
    .selectFrom('activityCheckpoints')
    .select('version')
    .where('activityId', '=', 'act_sweep')
    .execute();

  expect(summary).toStrictEqual({
    archived: 1,
    candidates: 1,
    changed: 0,
    deletedRows: 1,
    expiredArchives: 0,
    purged: 0,
  });

  expect(parseCheckpointArchive(archive)).toStrictEqual([
    {
      activityId: 'act_sweep',
      appendedAt: new Date('2026-01-01T00:00:01.000Z'),
      hash: 'hash_1',
      payload: {},
      prevHash: 'hash_0',
      version: 1,
    },
    {
      activityId: 'act_sweep',
      appendedAt: new Date('2026-01-01T00:00:02.000Z'),
      hash: 'hash_2',
      payload: {},
      prevHash: 'hash_1',
      version: 2,
    },
  ]);

  expect(remaining).toStrictEqual([{ version: 2 }]);
});

test('it skips an activity already archived on a rerun', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  const now = new Date();

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    id: 'act_rerun',
    status: 'stopped',
    verifiedAt: new Date(now.getTime() - 172_800_000),
    verifiedHead: 2,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values([
      { activityId: 'act_rerun', hash: 'hash_1', payload: {}, prevHash: 'hash_0', version: 1 },
      { activityId: 'act_rerun', hash: 'hash_2', payload: {}, prevHash: 'hash_1', version: 2 },
    ])
    .execute();

  await runCheckpointSweep(ctx, { apply: true, limit: 10, now });

  const rerun = await runCheckpointSweep(ctx, { apply: true, limit: 10, now });

  expect(rerun).toStrictEqual({
    archived: 0,
    candidates: 0,
    changed: 0,
    deletedRows: 0,
    expiredArchives: 0,
    purged: 0,
  });
});

test('it keeps the rows of an activity verified less than 24 hours ago', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  const now = new Date();

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    id: 'act_recent',
    status: 'stopped',
    verifiedAt: new Date(now.getTime() - 86_400_000 + 60_000),
    verifiedHead: 2,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values([
      { activityId: 'act_recent', hash: 'hash_1', payload: {}, prevHash: 'hash_0', version: 1 },
      { activityId: 'act_recent', hash: 'hash_2', payload: {}, prevHash: 'hash_1', version: 2 },
    ])
    .execute();

  await runCheckpointSweep(ctx, { apply: true, limit: 10, now });

  const rows = await ctx.db
    .selectFrom('activityCheckpoints')
    .select('version')
    .where('activityId', '=', 'act_recent')
    .orderBy('version')
    .execute();

  expect(rows).toStrictEqual([{ version: 1 }, { version: 2 }]);
});

test('it writes and deletes nothing without apply', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_report', userId: user.user.id });

  const now = new Date();

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    id: 'act_report',
    status: 'stopped',
    verifiedAt: new Date(now.getTime() - 172_800_000),
    verifiedHead: 2,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values([
      { activityId: 'act_report', hash: 'hash_1', payload: {}, prevHash: 'hash_0', version: 1 },
      { activityId: 'act_report', hash: 'hash_2', payload: {}, prevHash: 'hash_1', version: 2 },
    ])
    .execute();

  const summary = await runCheckpointSweep(ctx, { apply: false, limit: 10, now });
  const written = await ctx.bucket.exists('checkpoints/avatar_report/act_report.jsonl.gz');

  const remaining = await ctx.db
    .selectFrom('activityCheckpoints')
    .select('version')
    .where('activityId', '=', 'act_report')
    .orderBy('version')
    .execute();

  expect(summary).toStrictEqual({
    archived: 0,
    candidates: 1,
    changed: 0,
    deletedRows: 0,
    expiredArchives: 0,
    purged: 0,
  });

  expect(written).toBeFalse();
  expect(remaining).toStrictEqual([{ version: 1 }, { version: 2 }]);
});

test('it purges an archive older than 90 days whose head row carries the stamp', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_purge', userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    archivedAt: new Date(),
    avatarId: avatar.id,
    id: 'act_purge',
    status: 'stopped',
    verifiedAt: new Date(),
    verifiedHead: 2,
  });

  await ctx.bucket.write('checkpoints/avatar_purge/act_purge.jsonl.gz', 'archived rows');

  const summary = await runCheckpointSweep(ctx, {
    apply: true,
    limit: 10,
    now: new Date(Date.now() + 7_862_400_000),
  });

  const exists = await ctx.bucket.exists('checkpoints/avatar_purge/act_purge.jsonl.gz');

  expect(summary.purged).toBe(1);
  expect(exists).toBeFalse();
});

test('it purges an archive older than 90 days whose activity row is gone', async () => {
  const ctx = await setupTest();

  await ctx.bucket.write('checkpoints/avatar_deleted/act_orphan.jsonl.gz', 'archived rows');

  const summary = await runCheckpointSweep(ctx, {
    apply: true,
    limit: 10,
    now: new Date(Date.now() + 7_862_400_000),
  });

  const exists = await ctx.bucket.exists('checkpoints/avatar_deleted/act_orphan.jsonl.gz');

  expect(summary.purged).toBe(1);
  expect(exists).toBeFalse();
});

test('it keeps an archive younger than 90 days whose activity row is gone', async () => {
  const ctx = await setupTest();

  await ctx.bucket.write('checkpoints/avatar_deleted/act_young_orphan.jsonl.gz', 'archived rows');

  await runCheckpointSweep(ctx, {
    apply: true,
    limit: 10,
    now: new Date(Date.now() + 7_689_600_000),
  });

  const exists = await ctx.bucket.exists('checkpoints/avatar_deleted/act_young_orphan.jsonl.gz');

  expect(exists).toBeTrue();
});

test('it keeps an archive younger than 90 days', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_young', userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    archivedAt: new Date(),
    avatarId: avatar.id,
    id: 'act_young',
    status: 'stopped',
    verifiedAt: new Date(),
    verifiedHead: 2,
  });

  await ctx.bucket.write('checkpoints/avatar_young/act_young.jsonl.gz', 'archived rows');

  await runCheckpointSweep(ctx, {
    apply: true,
    limit: 10,
    now: new Date(Date.now() + 7_689_600_000),
  });

  const exists = await ctx.bucket.exists('checkpoints/avatar_young/act_young.jsonl.gz');

  expect(exists).toBeTrue();
});

test('it keeps an old archive whose head row carries no stamp', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_unstamped', userId: user.user.id });

  await createActivityRow(ctx.db, { avatarId: avatar.id, id: 'act_unstamped', status: 'active' });

  await ctx.bucket.write('checkpoints/avatar_unstamped/act_unstamped.jsonl.gz', 'archived rows');

  await runCheckpointSweep(ctx, {
    apply: true,
    limit: 10,
    now: new Date(Date.now() + 7_862_400_000),
  });

  const exists = await ctx.bucket.exists('checkpoints/avatar_unstamped/act_unstamped.jsonl.gz');

  expect(exists).toBeTrue();
});

test('it never removes the head row, the avatar items or the avatar grants', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_kept', userId: user.user.id });

  const archivedAt = new Date();

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    id: 'act_kept',
    scopeId: 'node_kept',
    status: 'stopped',
    verifiedAt: new Date(archivedAt.getTime() - 172_800_000),
    verifiedHead: 2,
  });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values([
      { activityId: 'act_kept', hash: 'hash_1', payload: {}, prevHash: 'hash_0', version: 1 },
      { activityId: 'act_kept', hash: 'hash_2', payload: {}, prevHash: 'hash_1', version: 2 },
    ])
    .execute();

  await ctx.db
    .insertInto('avatarItems')
    .values({
      affixes: [],
      avatarId: avatar.id,
      baseId: 'base_sword',
      chainIndex: 1,
      contentVersion: '0.0.0-dev',
      keyVersion: 1,
      ordinal: 0,
      rarityId: 'common',
      scopeId: 'node_kept',
      scopeType: 'world_map_node',
    })
    .execute();

  await ctx.db
    .insertInto('avatarGrants')
    .values({ avatarId: avatar.id, key: 'node_kept', kind: 'first_clear' })
    .execute();

  await runCheckpointSweep(ctx, { apply: true, limit: 10, now: archivedAt });

  await runCheckpointSweep(ctx, {
    apply: true,
    limit: 10,
    now: new Date(archivedAt.getTime() + 7_862_400_000),
  });

  const archiveExists = await ctx.bucket.exists('checkpoints/avatar_kept/act_kept.jsonl.gz');

  const heads = await ctx.db
    .selectFrom('activities')
    .select('id')
    .where('id', '=', 'act_kept')
    .execute();

  const items = await ctx.db
    .selectFrom('avatarItems')
    .select('baseId')
    .where('avatarId', '=', avatar.id)
    .execute();

  const grants = await ctx.db
    .selectFrom('avatarGrants')
    .select('key')
    .where('avatarId', '=', avatar.id)
    .execute();

  expect(archiveExists).toBeFalse();
  expect(heads).toStrictEqual([{ id: 'act_kept' }]);
  expect(items).toStrictEqual([{ baseId: 'base_sword' }]);
  expect(grants).toStrictEqual([{ key: 'node_kept' }]);
});
