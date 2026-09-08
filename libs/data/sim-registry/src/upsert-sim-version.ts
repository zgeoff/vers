import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { SimVersionRow, UpsertSimVersionInput } from './types';

export function upsertSimVersion(
  db: Kysely<DB>,
  input: Readonly<UpsertSimVersionInput>,
): Promise<SimVersionRow> {
  const retainedUntil = sql<Date>`now() + ${input.retentionDays} * interval '1 day'`;

  return db
    .insertInto('simVersions')
    .values({
      bunVersion: input.bunVersion,
      engineHash: input.engineHash,
      imageRef: input.imageRef,
      maxContentVersion: input.maxContentVersion,
      providerUrl: input.providerURL,
      retainedUntil,
      status: 'active',
    })
    .onConflict((oc) =>
      oc.column('engineHash').doUpdateSet({
        bunVersion: input.bunVersion,
        deployedAt: sql<Date>`now()`,
        imageRef: input.imageRef,
        maxContentVersion: input.maxContentVersion,
        providerUrl: input.providerURL,
        retainedUntil,
        status: 'active',
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow();
}
