import { expect, test } from 'bun:test';
import type { DB } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import type { Kysely } from 'kysely';
import { findLatestRelease } from './find-latest-release';
import { createReleaseRow } from './test-utils/create-release-row';

async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it picks the newest row for the app by deployedAt', async () => {
  await using ctx = await setupTest();

  await createReleaseRow(ctx.db, {
    app: 'vers-app-web',
    deployedAt: new Date('2026-01-01T00:00:00Z'),
  });

  const newer = await createReleaseRow(ctx.db, {
    app: 'vers-app-web',
    deployedAt: new Date('2026-02-01T00:00:00Z'),
  });

  expect(findLatestRelease(ctx.db, 'vers-app-web')).resolves.toStrictEqual(newer);
});

test('it ignores other apps rows even when they deployed most recently', async () => {
  await using ctx = await setupTest();

  const own = await createReleaseRow(ctx.db, {
    app: 'vers-app-web',
    deployedAt: new Date('2026-01-01T00:00:00Z'),
  });

  await createReleaseRow(ctx.db, {
    app: 'vers-service-user',
    deployedAt: new Date('2026-02-01T00:00:00Z'),
  });

  expect(findLatestRelease(ctx.db, 'vers-app-web')).resolves.toStrictEqual(own);
});

test('it breaks a deployedAt tie toward the later insert', async () => {
  await using ctx = await setupTest();

  const at = new Date('2026-01-01T00:00:00Z');

  await createReleaseRow(ctx.db, { app: 'vers-app-web', deployedAt: at });

  const later = await createReleaseRow(ctx.db, { app: 'vers-app-web', deployedAt: at });

  expect(findLatestRelease(ctx.db, 'vers-app-web')).resolves.toStrictEqual(later);
});

test('it returns undefined when the app has never recorded a release', async () => {
  await using ctx = await setupTest();

  expect(findLatestRelease(ctx.db, 'vers-app-web')).resolves.toBeUndefined();
});
