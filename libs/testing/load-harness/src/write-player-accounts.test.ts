import { expect, onTestFinished, test } from 'bun:test';
import { ActivityFailureAction, buildXPThreshold } from '@vers/idle-core';
import { createTestDB } from '@vers/service-test-utils/bun';
import invariant from 'tiny-invariant';
import { writePlayerAccounts } from './write-player-accounts';

async function setupTest() {
  const testDB = await createTestDB({ isolation: 'schema' });

  onTestFinished(() => testDB[Symbol.asyncDispose]());

  return { db: testDB.db };
}

test('it seeds each avatar at the XP its profile level starts from', async () => {
  const ctx = await setupTest();

  const [low, high] = await writePlayerAccounts(
    ctx.db,
    [
      { failureAction: ActivityFailureAction.Retry, index: 0, level: 3, simVersion: 'engine-a' },
      { failureAction: ActivityFailureAction.Retry, index: 1, level: 8, simVersion: 'engine-b' },
    ],
    'run7',
  );

  invariant(low !== undefined && high !== undefined);

  const avatars = await ctx.db
    .selectFrom('avatars')
    .select(['id', 'level', 'userId', 'xp'])
    .orderBy('seed')
    .execute();

  expect(avatars).toStrictEqual([
    { id: low.avatarID, level: 3, userId: low.userID, xp: buildXPThreshold(3) },
    { id: high.avatarID, level: 8, userId: high.userID, xp: buildXPThreshold(8) },
  ]);
});

test('it makes each seeded avatar the active avatar of its user', async () => {
  const ctx = await setupTest();

  const [account] = await writePlayerAccounts(
    ctx.db,
    [{ failureAction: ActivityFailureAction.Retry, index: 0, level: 1, simVersion: 'engine-a' }],
    'run8',
  );

  invariant(account !== undefined);

  const active = await ctx.db.selectFrom('activeAvatars').select(['avatarId', 'userId']).execute();

  expect(active).toStrictEqual([{ avatarId: account.avatarID, userId: account.userID }]);
});
