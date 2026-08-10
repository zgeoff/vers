import { expect, test } from 'bun:test';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import type { DB } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import type { Kysely } from 'kysely';
import { createContentVersion } from './create-content-version';
import { findContentDocument } from './find-content-document';
import { findCurrentContentVersion } from './find-current-content-version';

async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB({ isolation: 'schema' });

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it publishes a document and moves the current pointer to it', async () => {
  await using ctx = await setupTest();

  const document = createMockContentDocument();

  await createContentVersion(ctx.db, document);

  expect(findContentDocument(ctx.db, document.contentVersion)).resolves.toStrictEqual(document);
  expect(findCurrentContentVersion(ctx.db)).resolves.toBe(document.contentVersion);
});

test('it rejects a duplicate contentVersion and leaves the pointer untouched', async () => {
  await using ctx = await setupTest();

  const first = createMockContentDocument({ contentVersion: '31000' });
  const second = createMockContentDocument({ contentVersion: '31001' });

  await createContentVersion(ctx.db, first);
  await createContentVersion(ctx.db, second);

  // republishing the first document must not move the pointer back off the later version
  expect(createContentVersion(ctx.db, first)).rejects.toThrow();
  expect(findCurrentContentVersion(ctx.db)).resolves.toBe('31001');
});
