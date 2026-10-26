import { expect, onTestFinished, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { writeLoadRegistry } from './write-load-registry';

async function setupTest() {
  const testDB = await createTestDB();

  onTestFinished(() => testDB[Symbol.asyncDispose]());

  return { db: testDB.db };
}

test('it registers each engine version against its own replay provider', async () => {
  const ctx = await setupTest();

  await writeLoadRegistry(ctx.db, { current: 'engine-now', retained: 'engine-now-retained' });

  const rows = await ctx.db
    .selectFrom('simVersions')
    .select(['engineHash', 'providerUrl', 'status'])
    .where('engineHash', 'in', ['engine-now', 'engine-now-retained'])
    .orderBy('engineHash')
    .execute();

  expect(rows).toStrictEqual([
    { engineHash: 'engine-now', providerUrl: 'http://service-replay:3000', status: 'active' },
    {
      engineHash: 'engine-now-retained',
      providerUrl: 'http://service-replay-retained:3000',
      status: 'active',
    },
  ]);
});
