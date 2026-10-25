import { expect, onTestFinished, test } from 'bun:test';
import {
  createActivityRow,
  createAvatarRow,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { readArchiveCandidates } from './read-archive-candidates';

async function setupTest() {
  const testDB = await createTestDB();

  onTestFinished(() => testDB[Symbol.asyncDispose]());

  return { db: testDB.db };
}

test('it selects a stopped or capped activity verified before the cutoff, oldest first', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { id: 'avatar_candidates', userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 4,
    avatarId: avatar.id,
    id: 'act_newer',
    status: 'capped',
    verifiedAt: new Date('2026-01-02T00:00:00.000Z'),
    verifiedHead: 4,
  });

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: avatar.id,
    id: 'act_older',
    status: 'stopped',
    verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    verifiedHead: 3,
  });

  const candidates = await readArchiveCandidates(ctx.db, {
    limit: 10,
    verifiedBefore: new Date('2026-01-03T00:00:00.000Z'),
  });

  expect(candidates).toStrictEqual([
    { activityID: 'act_older', appendedHead: 3, avatarID: 'avatar_candidates' },
    { activityID: 'act_newer', appendedHead: 4, avatarID: 'avatar_candidates' },
  ]);
});

test('it selects no more activities than the limit', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    id: 'act_first',
    status: 'stopped',
    verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    verifiedHead: 2,
  });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    id: 'act_second',
    status: 'stopped',
    verifiedAt: new Date('2026-01-02T00:00:00.000Z'),
    verifiedHead: 2,
  });

  const candidates = await readArchiveCandidates(ctx.db, {
    limit: 1,
    verifiedBefore: new Date('2026-01-03T00:00:00.000Z'),
  });

  expect(candidates.map((candidate) => candidate.activityID)).toStrictEqual(['act_first']);
});

test.each([
  ['an active activity', { appendedHead: 2, status: 'active', verifiedHead: 2 }],
  ['a parked activity', { appendedHead: 2, status: 'parked', verifiedHead: 2 }],
  ['a quarantined activity', { appendedHead: 2, status: 'quarantined', verifiedHead: 2 }],
  ['a rejected activity', { appendedHead: 2, status: 'rejected', verifiedHead: 1 }],
  ['an activity with an unverified tail', { appendedHead: 3, status: 'stopped', verifiedHead: 2 }],
  ['an activity with no checkpoints', { appendedHead: 0, status: 'stopped', verifiedHead: 0 }],
] as const)('it keeps %s in the hot tier', async (_label, head) => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    ...head,
    avatarId: avatar.id,
    verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  const candidates = await readArchiveCandidates(ctx.db, {
    limit: 10,
    verifiedBefore: new Date('2026-01-03T00:00:00.000Z'),
  });

  expect(candidates).toStrictEqual([]);
});

test('it keeps an activity verified after the cutoff in the hot tier', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    status: 'stopped',
    verifiedAt: new Date('2026-01-03T00:00:00.001Z'),
    verifiedHead: 2,
  });

  const candidates = await readArchiveCandidates(ctx.db, {
    limit: 10,
    verifiedBefore: new Date('2026-01-03T00:00:00.000Z'),
  });

  expect(candidates).toStrictEqual([]);
});

test('it skips an activity already archived', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db, { password: null });
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    archivedAt: new Date('2026-01-02T00:00:00.000Z'),
    avatarId: avatar.id,
    status: 'stopped',
    verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    verifiedHead: 2,
  });

  const candidates = await readArchiveCandidates(ctx.db, {
    limit: 10,
    verifiedBefore: new Date('2026-01-03T00:00:00.000Z'),
  });

  expect(candidates).toStrictEqual([]);
});
