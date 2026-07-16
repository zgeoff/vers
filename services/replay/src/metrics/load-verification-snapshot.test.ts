import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createActivityRow } from '../test-utils/create-activity-row';
import { loadVerificationSnapshot } from './load-verification-snapshot';

test('it reports zeros with no activity streams', async () => {
  await using ctx = await createTestDB();

  const snapshot = await loadVerificationSnapshot(ctx.db);

  expect(snapshot).toStrictEqual({
    headDeltaP95: 0,
    lagSeconds: 0,
    parkedBySimVersion: [],
    quarantinedCount: 0,
  });
});

test('it reports the age of the oldest unverified append as the lag', async () => {
  await using ctx = await createTestDB();

  await createActivityRow(ctx.db, {
    appendedAt: new Date(Date.now() - 90_000),
    appendedHead: 5,
    verifiedHead: 2,
  });

  await createActivityRow(ctx.db, {
    appendedAt: new Date(Date.now() - 10_000),
    appendedHead: 3,
    verifiedHead: 1,
  });

  const snapshot = await loadVerificationSnapshot(ctx.db);

  expect(snapshot.lagSeconds).toBeWithin(80, 120);
});

test('it excludes rejected and fully verified streams from the lag', async () => {
  await using ctx = await createTestDB();

  await createActivityRow(ctx.db, {
    appendedAt: new Date(Date.now() - 600_000),
    appendedHead: 4,
    status: 'rejected',
    verifiedHead: 1,
  });

  await createActivityRow(ctx.db, {
    appendedAt: new Date(Date.now() - 600_000),
    appendedHead: 3,
    status: 'stopped',
    verifiedHead: 3,
  });

  await createActivityRow(ctx.db, {
    appendedAt: new Date(Date.now() - 15_000),
    appendedHead: 2,
    verifiedHead: 1,
  });

  const snapshot = await loadVerificationSnapshot(ctx.db);

  expect(snapshot.lagSeconds).toBeWithin(10, 45);
});

test('it keeps parked and quarantined streams in the lag', async () => {
  await using ctx = await createTestDB();

  await createActivityRow(ctx.db, {
    appendedAt: new Date(Date.now() - 300_000),
    appendedHead: 4,
    status: 'parked',
    verifiedHead: 0,
  });

  await createActivityRow(ctx.db, {
    appendedAt: new Date(Date.now() - 200_000),
    appendedHead: 6,
    status: 'quarantined',
    verifiedHead: 3,
  });

  const snapshot = await loadVerificationSnapshot(ctx.db);

  expect(snapshot.lagSeconds).toBeWithin(290, 330);
});

test('it reports the p95 head delta over unverified streams', async () => {
  await using ctx = await createTestDB();

  await createActivityRow(ctx.db, {
    appendedAt: new Date(),
    appendedHead: 3,
    verifiedHead: 2,
  });

  await createActivityRow(ctx.db, {
    appendedAt: new Date(),
    appendedHead: 11,
    verifiedHead: 0,
  });

  const snapshot = await loadVerificationSnapshot(ctx.db);

  expect(snapshot.headDeltaP95).toBe(10.5);
});

test('it counts quarantined activities regardless of their cursors', async () => {
  await using ctx = await createTestDB();

  await createActivityRow(ctx.db, { status: 'quarantined' });
  await createActivityRow(ctx.db, { status: 'quarantined' });
  await createActivityRow(ctx.db, { status: 'stopped' });

  const snapshot = await loadVerificationSnapshot(ctx.db);

  expect(snapshot.quarantinedCount).toBe(2);
});

test('it groups the parked backlog by sim version', async () => {
  await using ctx = await createTestDB();

  await createActivityRow(ctx.db, { simVersion: 'engine-a', status: 'parked' });
  await createActivityRow(ctx.db, { simVersion: 'engine-a', status: 'parked' });
  await createActivityRow(ctx.db, { simVersion: 'engine-b', status: 'parked' });
  await createActivityRow(ctx.db, { simVersion: 'engine-c', status: 'stopped' });

  const snapshot = await loadVerificationSnapshot(ctx.db);

  expect(snapshot.parkedBySimVersion).toIncludeSameMembers([
    { count: 2, simVersion: 'engine-a' },
    { count: 1, simVersion: 'engine-b' },
  ]);
});
