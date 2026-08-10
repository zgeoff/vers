import { expect, test } from 'bun:test';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import type { DB } from '@vers/db';
import { toJSON } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import type { Kysely } from 'kysely';
import { createContentVersion } from './create-content-version';
import { findContentDocument } from './find-content-document';

// `createContentVersion` opens its own interactive transaction, which the default
// transaction-isolation handle can't nest — this suite publishes in-test, so it runs against a
// real, committed schema clone.
async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB({ isolation: 'schema' });

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns a published document round-trip', async () => {
  await using ctx = await setupTest();

  const document = createMockContentDocument();

  await createContentVersion(ctx.db, document);

  expect(findContentDocument(ctx.db, document.contentVersion)).resolves.toStrictEqual(document);
});

test('it returns undefined for an unknown version', async () => {
  await using ctx = await setupTest();

  expect(findContentDocument(ctx.db, 'unknown')).resolves.toBeUndefined();
});

test('it rejects loudly on a malformed stored document', async () => {
  await using ctx = await setupTest();

  await ctx.db
    .insertInto('contentVersions')
    .values({ contentVersion: 'bad', document: toJSON({ nonsense: true }) })
    .execute();

  expect(findContentDocument(ctx.db, 'bad')).rejects.toThrow();
});
