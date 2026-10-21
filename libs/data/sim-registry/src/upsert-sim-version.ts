import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { SimVersionRow, UpsertSimVersionInput } from './types';

export function upsertSimVersion(
  db: Kysely<DB>,
  input: Readonly<UpsertSimVersionInput>,
): Promise<SimVersionRow> {
  return db
    .insertInto('simVersions')
    .values({
      bunVersion: input.bunVersion,
      engineHash: input.engineHash,
      imageRef: input.imageRef,
      maxContentVersion: input.maxContentVersion,
      providerUrl: input.providerURL,
      retainedUntil: sql`now() + ${input.retentionDays} * interval '1 day'`,
      status: 'active',
    })
    .onConflict((oc) =>
      oc.column('engineHash').doUpdateSet({
        bunVersion: input.bunVersion,
        deployedAt: sql`now()`,
        imageRef: input.imageRef,
        maxContentVersion: input.maxContentVersion,
        providerUrl: input.providerURL,
        retainedUntil: sql`now() + ${input.retentionDays} * interval '1 day'`,
        status: 'active',
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow();
}
