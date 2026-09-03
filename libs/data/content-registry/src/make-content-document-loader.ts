import type { ContentDocument } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { findContentDocument } from './find-content-document';

export function makeContentDocumentLoader(
  db: Kysely<DB>,
): (contentVersion: string) => Promise<ContentDocument | undefined> {
  const cache = new Map<string, Promise<ContentDocument | undefined>>();

  return async function loadContentDocument(
    contentVersion: string,
  ): Promise<ContentDocument | undefined> {
    const cached = cache.get(contentVersion);

    if (cached !== undefined) {
      return cached;
    }

    const pending = findContentDocument(db, contentVersion);

    cache.set(contentVersion, pending);

    const document = await pending.catch((error: unknown) => {
      cache.delete(contentVersion);
      throw error;
    });

    if (document === undefined) {
      cache.delete(contentVersion);
    }

    return document;
  };
}
