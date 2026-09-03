import { ContentDocumentSchema } from '@vers/contract-activity';
import type { ContentDocument } from '@vers/contract-activity';
import { CONTENT_DOCUMENT_STORE_NAME } from '../submission/constants';
import { resolveCheckpointQueueDB } from '../submission/resolve-checkpoint-queue-db';

export async function findCachedContentDocument(
  contentVersion: string,
): Promise<ContentDocument | undefined> {
  const db = await resolveCheckpointQueueDB();
  const stored = await db.get(CONTENT_DOCUMENT_STORE_NAME, contentVersion);

  if (stored === undefined) {
    return undefined;
  }

  const result = ContentDocumentSchema.safeParse(stored);

  if (!result.success) {
    await db.delete(CONTENT_DOCUMENT_STORE_NAME, contentVersion);

    return undefined;
  }

  return result.data;
}
