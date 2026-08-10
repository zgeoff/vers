import type { ContentDocument } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import { toJSON } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Publishes a new content version and moves the current pointer to it, in one transaction.
 * Append-only: a duplicate `contentVersion` fails on the primary key. Callers pass a
 * schema-parsed document.
 */
export async function createContentVersion(
  db: Kysely<DB>,
  document: Readonly<ContentDocument>,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('contentVersions')
      .values({ contentVersion: document.contentVersion, document: toJSON(document) })
      .execute();

    await trx
      .insertInto('contentCurrent')
      .values({ contentVersion: document.contentVersion })
      .onConflict((oc) =>
        oc
          .column('singleton')
          .doUpdateSet({ contentVersion: document.contentVersion, updatedAt: sql`now()` }),
      )
      .execute();
  });
}
