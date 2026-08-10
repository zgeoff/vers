import { expect, test } from 'bun:test';
import type { DB } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import type { Kysely } from 'kysely';
import { findCurrentSimVersion } from './find-current-sim-version';
import { createSimVersionRow } from './test-utils/create-sim-version-row';

async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it picks the newest active row by deployedAt', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2026-01-01T00:00:00Z'),
    engineHash: 'hash_older',
    status: 'active',
  });

  const newer = await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2026-02-01T00:00:00Z'),
    engineHash: 'hash_newer',
    status: 'active',
  });

  expect(findCurrentSimVersion(ctx.db)).resolves.toStrictEqual(newer);
});

test('it ignores pruned rows even when they deployed most recently', async () => {
  await using ctx = await setupTest();

  const active = await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2026-01-01T00:00:00Z'),
    engineHash: 'hash_active',
    status: 'active',
  });

  await createSimVersionRow(ctx.db, {
    deployedAt: new Date('2026-02-01T00:00:00Z'),
    engineHash: 'hash_pruned',
    status: 'pruned',
  });

  expect(findCurrentSimVersion(ctx.db)).resolves.toStrictEqual(active);
});

test('it breaks a deployedAt tie toward the later insert', async () => {
  await using ctx = await setupTest();

  const at = new Date('2026-01-01T00:00:00Z');

  await createSimVersionRow(ctx.db, {
    createdAt: new Date('2026-01-01T00:00:00Z'),
    deployedAt: at,
    engineHash: 'hash_first',
    status: 'active',
  });

  const later = await createSimVersionRow(ctx.db, {
    createdAt: new Date('2026-01-01T00:00:01Z'),
    deployedAt: at,
    engineHash: 'hash_second',
    status: 'active',
  });

  expect(findCurrentSimVersion(ctx.db)).resolves.toStrictEqual(later);
});

test('it returns undefined when no version is active', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db, { engineHash: 'hash_pruned', status: 'pruned' });

  expect(findCurrentSimVersion(ctx.db)).resolves.toBeUndefined();
});
