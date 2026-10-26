import { expect, mock, onTestFinished, test } from 'bun:test';
import {
  createActivityRow,
  createAvatarRow,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { makeAnswerQueue, waitFor } from '@vers/test-utils';
import { sql } from 'kysely';
import { createLoadSampler } from './create-load-sampler';

async function setupTest() {
  const testDB = await createTestDB({ isolation: 'schema' });

  onTestFinished(() => testDB[Symbol.asyncDispose]());

  return { db: testDB.db };
}

test('it ages a proof that lands after its last tick', async () => {
  const ctx = await setupTest();
  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });
  const activity = await createActivityRow(ctx.db, { appendedHead: 2, avatarId: avatar.id });

  await ctx.db
    .insertInto('activityCheckpoints')
    .values(
      [1, 2].map((version) => ({
        activityId: activity.id,
        appendedAt: sql`now() at time zone 'UTC'`,
        hash: `h${version}`,
        payload: {},
        prevHash: `h${version - 1}`,
        version,
      })),
    )
    .execute();

  const sampler = await createLoadSampler({
    containerPrefix: 'vers-load-',
    db: ctx.db,
    intervalMs: 60_000,
    readContainerStats: () => Promise.resolve(''),
  });

  await ctx.db
    .updateTable('activities')
    .set({ verifiedHead: 2 })
    .where('id', '=', activity.id)
    .execute();

  const recording = await sampler.stop();

  expect(recording.settlementAges).toHaveLength(2);
});

test('it rethrows a failed sample from its stop', async () => {
  const ctx = await setupTest();

  const nextContainerStats = makeAnswerQueue<() => Promise<string>>([
    () => Promise.resolve(''),
    () => Promise.reject(new Error('docker stats failed')),
  ]);

  const readContainerStats = mock(() => nextContainerStats()());

  const sampler = await createLoadSampler({
    containerPrefix: 'vers-load-',
    db: ctx.db,
    intervalMs: 5,
    readContainerStats,
  });

  await waitFor(() => {
    expect(readContainerStats).toHaveBeenCalledTimes(2);
  });

  expect(sampler.stop()).rejects.toThrow('docker stats failed');
});

test('it records the containers that match its prefix', async () => {
  const ctx = await setupTest();

  const sampler = await createLoadSampler({
    containerPrefix: 'vers-load-',
    db: ctx.db,
    intervalMs: 60_000,
    readContainerStats: () =>
      Promise.resolve(
        [
          '{"Name":"vers-load-postgres-1","CPUPerc":"12.50%","MemUsage":"100MiB / 1GiB"}',
          '{"Name":"other-postgres-1","CPUPerc":"3.00%","MemUsage":"10MiB / 1GiB"}',
        ].join('\n'),
      ),
  });

  const recording = await sampler.stop();

  expect(recording.containers.map((sample) => sample.container)).toStrictEqual([
    'vers-load-postgres-1',
  ]);
});
