import { expect, test } from 'bun:test';
import { CONTENT_DOCUMENT_STORE_NAME } from '../submission/constants';
import { resolveCheckpointQueueDB } from '../submission/resolve-checkpoint-queue-db';
import { readCachedContentDocument } from './read-cached-content-document';

test('it returns undefined for a version never cached', () => {
  expect(readCachedContentDocument('never-cached')).resolves.toBeUndefined();
});

test('it deletes and returns undefined for a stored value that fails the contract schema', async () => {
  const db = await resolveCheckpointQueueDB();

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a deliberately malformed row exercising the self-healing parse failure path
  await db.put(CONTENT_DOCUMENT_STORE_NAME, {
    contentVersion: 'malformed',
    nonsense: true,
  } as never);

  const found = await readCachedContentDocument('malformed');

  expect(found).toBeUndefined();

  const stillStored = await db.get(CONTENT_DOCUMENT_STORE_NAME, 'malformed');

  expect(stillStored).toBeUndefined();
});
