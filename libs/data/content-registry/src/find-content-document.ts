import { ContentDocumentSchema } from '@vers/contract-activity';
import type { ContentDocument } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

export async function findContentDocument(
  db: Kysely<DB>,
  contentVersion: string,
): Promise<ContentDocument | undefined> {
  const row = await db
    .selectFrom('contentVersions')
    .select('document')
    .where('contentVersion', '=', contentVersion)
    .executeTakeFirst();

  return row === undefined ? undefined : ContentDocumentSchema.parse(row.document);
}
