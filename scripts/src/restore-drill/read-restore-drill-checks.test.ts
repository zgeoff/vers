import { expect, test } from 'bun:test';
import {
  createActivityRow,
  createAvatarRow,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { readRestoreDrillChecks } from './read-restore-drill-checks';
import type { RestoreDrillCheck } from './types';

async function setupTest() {
  const db = await createTestDB({ isolation: 'database' });

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it runs every area’s checks against an empty database and finds no violation', async () => {
  await using ctx = await setupTest();

  const checks = await readRestoreDrillChecks(ctx.db);

  expect(checks.map((check) => `${check.area}: ${check.name}`)).toStrictEqual([
    'sessions: one verified session per user',
    'sessions: a verified session holds a refresh token',
    'chain-anchors: the verified anchor sits at or behind the appended anchor',
    'chain-anchors: an active activity starts at its chain’s appended anchor',
    'chain-anchors: every activity has its chain',
    'verified-progress: the verified head sits at or behind the appended head',
    'verified-progress: the appended head matches the stream’s last checkpoint',
    'verified-progress: settled XP comes only from verified checkpoints',
    'item-identities: every item sits at a verified chain position',
    'item-identities: no two live activities claim one chain position',
    'item-identities: every item’s content version is published',
    'retained-sim-versions: unverified work pins a retained sim version',
    'retained-sim-versions: every activity’s content version is published',
  ]);

  expect(checks).toSatisfyAll((check: RestoreDrillCheck) => check.violations.length === 0);
});

test('it reports a violation that the restored state holds', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    contentVersion: '1',
    id: 'act_chainless',
    status: 'stopped',
  });

  const checks = await readRestoreDrillChecks(ctx.db);

  expect(checks.filter((check) => check.violations.length > 0)).toStrictEqual([
    {
      area: 'chain-anchors',
      name: 'every activity has its chain',
      violations: ['activity act_chainless'],
    },
  ]);
});
