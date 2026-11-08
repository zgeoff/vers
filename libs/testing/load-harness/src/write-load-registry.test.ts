import { expect, onTestFinished, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { readSimVersion } from '@vers/sim-registry';
import { writeLoadRegistry } from './write-load-registry';

async function setupTest() {
  const testDB = await createTestDB();

  onTestFinished(() => testDB[Symbol.asyncDispose]());

  return { db: testDB.db };
}

test('it registers each engine version against its own replay provider', async () => {
  const ctx = await setupTest();

  await writeLoadRegistry(ctx.db, { current: 'engine-now', retained: 'engine-now-retained' });

  const current = await readSimVersion(ctx.db, 'engine-now');
  const retained = await readSimVersion(ctx.db, 'engine-now-retained');

  expect(current).toStrictEqual({
    bunVersion: Bun.version,
    createdAt: expect.toBeValidDate(),
    deployedAt: expect.toBeValidDate(),
    engineHash: 'engine-now',
    imageRef: 'load-stack/current',
    maxContentVersion: expect.any(String),
    providerUrl: 'http://service-replay:3000',
    retainedUntil: expect.toBeValidDate(),
    status: 'active',
  });

  expect(retained).toStrictEqual({
    bunVersion: Bun.version,
    createdAt: expect.toBeValidDate(),
    deployedAt: expect.toBeValidDate(),
    engineHash: 'engine-now-retained',
    imageRef: 'load-stack/retained',
    maxContentVersion: expect.any(String),
    providerUrl: 'http://service-replay-retained:3000',
    retainedUntil: expect.toBeValidDate(),
    status: 'active',
  });
});
