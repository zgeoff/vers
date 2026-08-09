import type { ContentDocument } from '@vers/contract-activity';
import type { ActivityServiceClient } from '../submission/types';
import { findCachedContentDocument } from './find-cached-content-document';
import { writeContentDocumentCache } from './write-content-document-cache';

/**
 * Resolves a pinned content version's document: an IndexedDB cache hit returns immediately, a
 * miss fetches over the activity service and persists the result before returning it. Documents
 * are immutable once published, so the cached row never needs revalidation — the IDB row is the
 * only cache. A `NOT_FOUND` from the fetch propagates uncaught, to the worker's existing fault
 * handling.
 */
export async function loadContentDocument(
  client: Pick<ActivityServiceClient, 'getContentDocument'>,
  contentVersion: string,
  signal?: AbortSignal,
): Promise<ContentDocument> {
  const cached = await findCachedContentDocument(contentVersion);

  if (cached !== undefined) {
    return cached;
  }

  const callOptions = signal === undefined ? undefined : { signal };

  const document = await client.getContentDocument({ contentVersion }, callOptions);

  await writeContentDocumentCache(document);

  return document;
}
