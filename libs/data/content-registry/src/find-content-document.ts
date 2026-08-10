import { ContentDocumentSchema } from '@vers/contract-activity';
import type { ContentDocument } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

/**
 * Looks up a published content document by version — undefined on miss, and a schema-validated
 * structure on hit, since a stored row's jsonb payload re-enters typed code only through its
 * contract schema.
 */
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
