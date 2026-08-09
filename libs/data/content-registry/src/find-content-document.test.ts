import { expect, test } from 'bun:test';
import { ContentDocumentSchema } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import { contentDocumentV2, toJSON } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import type { Kysely } from 'kysely';
import { findContentDocument } from './find-content-document';

async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns the seeded v2 document', async () => {
  await using ctx = await setupTest();

  await expect(findContentDocument(ctx.db, '2')).resolves.toStrictEqual(
    ContentDocumentSchema.parse(contentDocumentV2),
  );
});

test('it returns undefined for an unknown version', async () => {
  await using ctx = await setupTest();

  await expect(findContentDocument(ctx.db, 'unknown')).resolves.toBeUndefined();
});

test('it rejects loudly on a malformed stored document', async () => {
  await using ctx = await setupTest();

  await ctx.db
    .insertInto('contentVersions')
    .values({ contentVersion: 'bad', document: toJSON({ nonsense: true }) })
    .execute();

  await expect(findContentDocument(ctx.db, 'bad')).rejects.toThrow();
});
