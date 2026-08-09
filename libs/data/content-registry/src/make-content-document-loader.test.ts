import { expect, test } from 'bun:test';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import type { DB } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import type { Kysely } from 'kysely';
import { createContentVersion } from './create-content-version';
import { makeContentDocumentLoader } from './make-content-document-loader';

async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB({ isolation: 'schema' });

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it loads a known version and re-loads it equal', async () => {
  await using ctx = await setupTest();

  const document = createMockContentDocument();

  await createContentVersion(ctx.db, document);

  const loadContentDocument = makeContentDocumentLoader(ctx.db);

  const first = await loadContentDocument(document.contentVersion);
  const second = await loadContentDocument(document.contentVersion);

  expect(first).toStrictEqual(second);
});

test('it does not cache a miss, so a later publish becomes loadable', async () => {
  await using ctx = await setupTest();

  const loadContentDocument = makeContentDocumentLoader(ctx.db);

  await expect(loadContentDocument('not-yet-published')).resolves.toBeUndefined();
  await expect(loadContentDocument('not-yet-published')).resolves.toBeUndefined();

  const document = createMockContentDocument({ contentVersion: 'not-yet-published' });

  await createContentVersion(ctx.db, document);

  await expect(loadContentDocument('not-yet-published')).resolves.toStrictEqual(document);
});
