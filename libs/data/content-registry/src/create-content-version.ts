import type { ContentDocument } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import { toJSON } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';

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
