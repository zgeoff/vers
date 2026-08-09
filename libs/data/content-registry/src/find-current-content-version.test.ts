import { expect, test } from 'bun:test';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import type { DB } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import type { Kysely } from 'kysely';
import { createContentVersion } from './create-content-version';
import { findCurrentContentVersion } from './find-current-content-version';

// `createContentVersion` opens its own interactive transaction, which the default
// transaction-isolation handle can't nest; database isolation gives a real top-level `db` that
// still carries the migration's seeded rows, unlike schema isolation's structure-only clone.
async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB({ isolation: 'database' });

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns the seeded current version', async () => {
  await using ctx = await setupTest();

  await expect(findCurrentContentVersion(ctx.db)).resolves.toBe('2');
});

test('it follows the pointer after a new version publishes', async () => {
  await using ctx = await setupTest();

  const document = createMockContentDocument();

  await createContentVersion(ctx.db, document);

  await expect(findCurrentContentVersion(ctx.db)).resolves.toBe(document.contentVersion);
});
