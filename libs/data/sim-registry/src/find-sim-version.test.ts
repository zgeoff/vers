import { expect, test } from 'bun:test';
import type { DB } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import type { Kysely } from 'kysely';
import { findSimVersion } from './find-sim-version';
import { createSimVersionRow } from './test-utils/create-sim-version-row';

async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it finds a sim version row by engine hash', async () => {
  await using ctx = await setupTest();

  const row = await createSimVersionRow(ctx.db, { engineHash: 'hash_1' });

  expect(findSimVersion(ctx.db, 'hash_1')).resolves.toStrictEqual(row);
});

test('it returns undefined for an engine hash with no registered row', async () => {
  await using ctx = await setupTest();

  expect(findSimVersion(ctx.db, 'hash_missing')).resolves.toBeUndefined();
});
