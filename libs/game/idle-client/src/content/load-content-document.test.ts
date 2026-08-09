import { expect, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { resolveServiceURL } from '@vers/mock-services';
import type { ActivityServiceClient } from '../submission/types';
import { findCachedContentDocument } from './find-cached-content-document';
import { loadContentDocument } from './load-content-document';
import { writeContentDocumentCache } from './write-content-document-cache';

function createRealClient(): ActivityServiceClient {
  return createORPCClient(new RPCLink({ url: `${resolveServiceURL('activity')}/rpc` }));
}

test('it returns a cached document without dispatching a fetch', async () => {
  const cached = createMockContentDocument();

  await writeContentDocumentCache(cached);

  const client: Pick<ActivityServiceClient, 'getContentDocument'> = {
    getContentDocument: () => {
      throw new Error('a cache hit must never dispatch a fetch');
    },
  };

  const document = await loadContentDocument(client, cached.contentVersion);

  expect(document).toStrictEqual(cached);
});

test('it fetches and persists a document on a cache miss', async () => {
  const document = await loadContentDocument(createRealClient(), '2');

  expect(document.contentVersion).toBe('2');

  const nowCached = await findCachedContentDocument('2');

  expect(nowCached).toStrictEqual(document);
});

test('it propagates NOT_FOUND for an unpublished version', () => {
  expect(loadContentDocument(createRealClient(), 'not-a-real-version')).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});
