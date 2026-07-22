import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createActivityRow } from '../test-utils/create-activity-row';
import { createSnapshotSourceRow } from '../test-utils/create-snapshot-source-row';
import { hasRejectedSnapshotSource } from './has-rejected-snapshot-source';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it reports a snapshot that borrowed xp from a rejected run', async () => {
  await using ctx = await setupTest();

  const source = await createActivityRow(ctx.db, { status: 'rejected' });
  const borrower = await createActivityRow(ctx.db, { avatarId: source.avatarId });

  await createSnapshotSourceRow(ctx.db, {
    activityID: borrower.id,
    sourceActivityID: source.id,
  });

  const unbacked = await hasRejectedSnapshotSource(ctx.db, borrower.id);

  expect(unbacked).toBeTrue();
});

test('it reports nothing for a snapshot that borrowed no xp', async () => {
  await using ctx = await setupTest();

  const activity = await createActivityRow(ctx.db);
  const unbacked = await hasRejectedSnapshotSource(ctx.db, activity.id);

  expect(unbacked).toBeFalse();
});

test('it reports nothing while every run the snapshot borrowed from stands', async () => {
  await using ctx = await setupTest();

  const source = await createActivityRow(ctx.db, { status: 'stopped', verifiedHead: 4 });
  const borrower = await createActivityRow(ctx.db, { avatarId: source.avatarId });

  await createSnapshotSourceRow(ctx.db, {
    activityID: borrower.id,
    sourceActivityID: source.id,
  });

  const unbacked = await hasRejectedSnapshotSource(ctx.db, borrower.id);

  expect(unbacked).toBeFalse();
});

test('it reports a rejection among several runs the snapshot borrowed from', async () => {
  await using ctx = await setupTest();

  const honest = await createActivityRow(ctx.db, { status: 'stopped', verifiedHead: 4 });

  const rejected = await createActivityRow(ctx.db, {
    avatarId: honest.avatarId,
    status: 'rejected',
  });

  const borrower = await createActivityRow(ctx.db, { avatarId: honest.avatarId });

  await createSnapshotSourceRow(ctx.db, {
    activityID: borrower.id,
    sourceActivityID: honest.id,
  });

  await createSnapshotSourceRow(ctx.db, {
    activityID: borrower.id,
    sourceActivityID: rejected.id,
  });

  const unbacked = await hasRejectedSnapshotSource(ctx.db, borrower.id);

  expect(unbacked).toBeTrue();
});
