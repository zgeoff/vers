import { expect, test } from 'bun:test';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import type { DB } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import type { Kysely } from 'kysely';
import { createContentVersion } from './create-content-version';
import { findCurrentContentVersion } from './find-current-content-version';

// `createContentVersion` opens its own interactive transaction, which the default
// transaction-isolation handle can't nest — this suite publishes in-test, so it runs against a
// real, committed schema clone. The clone is structure-only, which is also what the never-seeded
// case relies on.
async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB({ isolation: 'schema' });

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns undefined before the registry has ever been seeded', async () => {
  await using ctx = await setupTest();

  expect(findCurrentContentVersion(ctx.db)).resolves.toBeUndefined();
});

test('it follows the pointer after a new version publishes', async () => {
  await using ctx = await setupTest();

  const document = createMockContentDocument();

  await createContentVersion(ctx.db, document);

  expect(findCurrentContentVersion(ctx.db)).resolves.toBe(document.contentVersion);
});
