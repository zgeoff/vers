import { expect, test } from 'bun:test';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { readCachedContentDocument } from './read-cached-content-document';
import { writeContentDocumentCache } from './write-content-document-cache';

test('it persists a document readable back by its own contentVersion', async () => {
  const document = createMockContentDocument();

  await writeContentDocumentCache(document);

  expect(readCachedContentDocument(document.contentVersion)).resolves.toStrictEqual(document);
});
