import { expect, onTestFinished, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { withArchiveLock } from './with-archive-lock';

async function setupTest() {
  const testDB = await createTestDB({ isolation: 'database' });

  onTestFinished(() => testDB[Symbol.asyncDispose]());

  return { db: testDB.db };
}

test('it runs the callback while it holds the archive lock', async () => {
  const ctx = await setupTest();
  const outcome = await withArchiveLock(ctx.db, () => Promise.resolve('swept'));

  expect(outcome).toStrictEqual({ kind: 'locked', result: 'swept' });
});

test('it reports busy and skips the work while another run holds the lock', async () => {
  const ctx = await setupTest();

  const release = Promise.withResolvers<undefined>();
  const held = Promise.withResolvers<undefined>();

  const holder = withArchiveLock(ctx.db, async () => {
    held.resolve(undefined);

    await release.promise;
  });

  await held.promise;

  const outcome = await withArchiveLock(ctx.db, () => Promise.resolve('swept'));

  release.resolve(undefined);

  await holder;

  expect(outcome).toStrictEqual({ kind: 'busy' });
});

test('it releases the lock when the work ends', async () => {
  const ctx = await setupTest();

  await withArchiveLock(ctx.db, () => Promise.resolve('first'));

  const outcome = await withArchiveLock(ctx.db, () => Promise.resolve('second'));

  expect(outcome).toStrictEqual({ kind: 'locked', result: 'second' });
});
