import { expect, test } from 'bun:test';
import {
  createActivityRow,
  createAvatarRow,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { readSimVersionChecks } from './read-sim-version-checks';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it finds no violation when unverified work pins a retained sim version and published content', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  const engine = await createSimVersionRow(ctx.db, {
    retainedUntil: new Date(Date.now() + 86_400_000),
    status: 'active',
  });

  const prunedEngine = await createSimVersionRow(ctx.db, { status: 'pruned' });

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: avatar.id,
    contentVersion: '1',
    simVersion: engine.engineHash,
    verifiedHead: 1,
  });

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: avatar.id,
    contentVersion: '1',
    simVersion: prunedEngine.engineHash,
    status: 'stopped',
    verifiedHead: 3,
  });

  const checks = await readSimVersionChecks(ctx.db);

  expect(checks).toStrictEqual([
    {
      area: 'retained-sim-versions',
      name: 'unverified work pins a retained sim version',
      violations: [],
    },
    {
      area: 'retained-sim-versions',
      name: 'every activity’s content version is published',
      violations: [],
    },
  ]);
});

test('it reports unverified work on an unregistered, pruned, or expired sim version', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  const prunedEngine = await createSimVersionRow(ctx.db, {
    engineHash: 'engine-pruned',
    retainedUntil: new Date(Date.now() + 86_400_000),
    status: 'pruned',
  });

  const expiredEngine = await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2026-10-01T09:00:00Z'),
    engineHash: 'engine-expired',
    retainedUntil: new Date(Date.now() - 60_000),
    status: 'active',
  });

  await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2026-10-20T09:00:00Z'),
    engineHash: 'engine-current',
    retainedUntil: new Date(Date.now() + 86_400_000),
    status: 'active',
  });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    contentVersion: '1',
    id: 'act_on_pruned',
    simVersion: prunedEngine.engineHash,
    status: 'stopped',
  });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    contentVersion: '1',
    id: 'act_on_expired',
    simVersion: expiredEngine.engineHash,
    status: 'stopped',
  });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    contentVersion: '1',
    id: 'act_on_unknown',
    simVersion: 'engine-unregistered',
  });

  const checks = await readSimVersionChecks(ctx.db);

  expect(checks[0]).toStrictEqual({
    area: 'retained-sim-versions',
    name: 'unverified work pins a retained sim version',
    violations: [
      'activity act_on_expired on sim version engine-expired',
      'activity act_on_pruned on sim version engine-pruned',
      'activity act_on_unknown on sim version engine-unregistered',
    ],
  });
});

test('it accepts unverified work on the current sim version past its retention deadline', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  const currentEngine = await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2026-10-20T09:00:00Z'),
    engineHash: 'engine-current',
    retainedUntil: new Date(Date.now() - 60_000),
    status: 'active',
  });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    contentVersion: '1',
    simVersion: currentEngine.engineHash,
  });

  const checks = await readSimVersionChecks(ctx.db);

  expect(checks[0]).toStrictEqual({
    area: 'retained-sim-versions',
    name: 'unverified work pins a retained sim version',
    violations: [],
  });
});

test('it leaves out a parked activity, which already waits on an operator for its engine', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    appendedHead: 2,
    avatarId: avatar.id,
    contentVersion: '1',
    parkedFrom: 'stopped',
    simVersion: 'engine-unregistered',
    status: 'parked',
  });

  const checks = await readSimVersionChecks(ctx.db);

  expect(checks[0]).toStrictEqual({
    area: 'retained-sim-versions',
    name: 'unverified work pins a retained sim version',
    violations: [],
  });
});

test('it reports an activity whose content version is unpublished', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    contentVersion: '9.9.9-missing',
    id: 'act_unpublished',
  });

  const checks = await readSimVersionChecks(ctx.db);

  expect(checks[1]).toStrictEqual({
    area: 'retained-sim-versions',
    name: 'every activity’s content version is published',
    violations: ['activity act_unpublished on content version 9.9.9-missing'],
  });
});
