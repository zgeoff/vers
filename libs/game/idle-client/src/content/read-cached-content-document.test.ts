import { expect, test } from 'bun:test';
import { unwrap } from 'idb';
import { CONTENT_DOCUMENT_STORE_NAME } from '../submission/constants';
import { resolveCheckpointQueueDB } from '../submission/resolve-checkpoint-queue-db';
import { readCachedContentDocument } from './read-cached-content-document';

test('it returns undefined for a version never cached', () => {
  expect(readCachedContentDocument('never-cached')).resolves.toBeUndefined();
});

test('it deletes and returns undefined for a stored value that fails the contract schema', async () => {
  const db = await resolveCheckpointQueueDB();

  const transaction = db.transaction(CONTENT_DOCUMENT_STORE_NAME, 'readwrite');

  unwrap(transaction.store).put({ contentVersion: 'malformed', nonsense: true });

  await transaction.done;

  const found = await readCachedContentDocument('malformed');

  expect(found).toBeUndefined();

  const stillStored = await db.get(CONTENT_DOCUMENT_STORE_NAME, 'malformed');

  expect(stillStored).toBeUndefined();
});
