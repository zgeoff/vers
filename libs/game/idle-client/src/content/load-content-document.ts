import type { ContentDocument } from '@vers/contract-activity';
import type { ActivityServiceClient } from '../submission/types';
import { findCachedContentDocument } from './find-cached-content-document';
import { writeContentDocumentCache } from './write-content-document-cache';

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
