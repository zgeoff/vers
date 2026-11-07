import { expect, test } from 'bun:test';
import { readActivityStatus } from './read-activity-status';
import { createTestDB } from './test-support/create-test-db';
import { transitionActivityStatus } from './transition-activity-status';

function setupTest() {
  return createTestDB();
}

test('it reads the status and the parked-from status of an activity', async () => {
  await using ctx = await setupTest();

  await ctx.db
    .insertInto('users')
    .values({
      email: 'status-reader@example.com',
      id: 'usr_status_reader',
      name: 'Status Reader',
      username: 'status_reader',
    })
    .execute();

  await ctx.db
    .insertInto('avatars')
    .values({ id: 'avt_status_reader', name: 'wanderer', userId: 'usr_status_reader' })
    .execute();

  await ctx.db
    .insertInto('activities')
    .values({
      avatarId: 'avt_status_reader',
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '2',
      encounterNode: { difficulty: 1 },
      id: 'act_status_reader',
      lastHash: 'aa11',
      scopeId: '0_0',
      scopeType: 'world_map_node',
      secretRef: 'worldmap',
      secretVersion: 1,
      seed: 'bb22',
      simVersion: 'engine-a',
      startHash: 'aa11',
    })
    .execute();

  await transitionActivityStatus(ctx.db, 'act_status_reader', {
    from: ['active'],
    to: 'parked',
  }).execute();

  const activity = await readActivityStatus(ctx.db, 'act_status_reader');

  expect(activity).toStrictEqual({
    parkedFrom: 'active',
    status: 'parked',
  });
});

test('it returns null for an unknown activity', async () => {
  await using ctx = await setupTest();

  const activity = await readActivityStatus(ctx.db, 'act_missing');

  expect(activity).toBeNull();
});
