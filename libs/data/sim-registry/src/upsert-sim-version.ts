import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { SimVersionRow, UpsertSimVersionInput } from './types';

export const DEFAULT_RETENTION_DAYS = 30;

export function upsertSimVersion(
  db: Kysely<DB>,
  input: Readonly<UpsertSimVersionInput>,
): Promise<SimVersionRow> {
  const retentionDays = input.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const retainedUntil = sql<Date>`now() + ${retentionDays} * interval '1 day'`;

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
