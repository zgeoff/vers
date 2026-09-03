import type { ContentDocument } from '@vers/contract-activity';
import { CONTENT_DOCUMENT_STORE_NAME } from '../submission/constants';
import { resolveCheckpointQueueDB } from '../submission/resolve-checkpoint-queue-db';

export async function writeContentDocumentCache(
  document: Readonly<ContentDocument>,
): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.put(CONTENT_DOCUMENT_STORE_NAME, document);
}
