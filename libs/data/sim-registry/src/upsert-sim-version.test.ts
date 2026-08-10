import { expect, test } from 'bun:test';
import type { DB } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import type { Kysely } from 'kysely';
import { createSimVersionRow } from './test-utils/create-sim-version-row';
import { DEFAULT_RETENTION_DAYS, upsertSimVersion } from './upsert-sim-version';

async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it inserts a new row for an unregistered engine hash', async () => {
  await using ctx = await setupTest();

  const before = Date.now();

  const row = await upsertSimVersion(ctx.db, {
    bunVersion: '1.3.10',
    engineHash: 'hash_new',
    imageRef: 'registry.fly.io/vers-sim:new',
    maxContentVersion: '2',
    providerURL: 'https://sim-new.internal',
  });

  expect(row).toMatchObject({
    bunVersion: '1.3.10',
    engineHash: 'hash_new',
    imageRef: 'registry.fly.io/vers-sim:new',
    maxContentVersion: '2',
    providerUrl: 'https://sim-new.internal',
    status: 'active',
  });

  const retentionMs = row.retainedUntil.getTime() - before;

  expect(retentionMs).toBeWithin(
    (DEFAULT_RETENTION_DAYS - 1) * 24 * 60 * 60 * 1000,
    (DEFAULT_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000,
  );
});

test('it applies a given retentionDays instead of the default', async () => {
  await using ctx = await setupTest();

  const before = Date.now();

  const row = await upsertSimVersion(ctx.db, {
    bunVersion: '1.3.10',
    engineHash: 'hash_short',
    imageRef: 'registry.fly.io/vers-sim:short',
    maxContentVersion: '2',
    providerURL: 'https://sim-short.internal',
    retentionDays: 3,
  });

  const retentionMs = row.retainedUntil.getTime() - before;

  expect(retentionMs).toBeWithin(2 * 24 * 60 * 60 * 1000, 4 * 24 * 60 * 60 * 1000);
});

test('it refreshes image, provider, bun version, max content version, deploy time, retention, and revives a pruned row on conflict', async () => {
  await using ctx = await setupTest();

  const existing = await createSimVersionRow(ctx.db, {
    bunVersion: '1.2.0',
    deployedAt: new Date('2026-01-01T00:00:00Z'),
    engineHash: 'hash_existing',
    imageRef: 'registry.fly.io/vers-sim:old',
    maxContentVersion: '1',
    providerUrl: 'https://sim-old.internal',
    retainedUntil: new Date('2026-01-31T00:00:00Z'),
    status: 'pruned',
  });

  const updated = await upsertSimVersion(ctx.db, {
    bunVersion: '1.3.10',
    engineHash: 'hash_existing',
    imageRef: 'registry.fly.io/vers-sim:rebuilt',
    maxContentVersion: '2',
    providerURL: 'https://sim-rebuilt.internal',
  });

  expect(updated).toMatchObject({
    bunVersion: '1.3.10',
    engineHash: 'hash_existing',
    imageRef: 'registry.fly.io/vers-sim:rebuilt',
    maxContentVersion: '2',
    providerUrl: 'https://sim-rebuilt.internal',
    status: 'active',
  });

  expect(updated.deployedAt.getTime()).toBeGreaterThan(existing.deployedAt.getTime());
  expect(updated.retainedUntil.getTime()).toBeGreaterThan(existing.retainedUntil.getTime());
});

test('it does not insert a second row on conflict', async () => {
  await using ctx = await setupTest();

  await createSimVersionRow(ctx.db, { engineHash: 'hash_existing' });

  await upsertSimVersion(ctx.db, {
    bunVersion: '1.3.10',
    engineHash: 'hash_existing',
    imageRef: 'registry.fly.io/vers-sim:rebuilt',
    maxContentVersion: '2',
    providerURL: 'https://sim-rebuilt.internal',
  });

  const rows = await ctx.db
    .selectFrom('simVersions')
    .selectAll()
    .where('engineHash', '=', 'hash_existing')
    .execute();

  expect(rows).toHaveLength(1);
});
