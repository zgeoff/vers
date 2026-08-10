import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { SimVersionRow, UpsertSimVersionInput } from './types';

/**
 * Days a `sim_versions` row is retained past its deploy when the caller doesn't override it.
 */
export const DEFAULT_RETENTION_DAYS = 30;

/**
 * Registers a built sim engine image in a single statement: a new `engineHash` inserts a fresh
 * row, a known one refreshes its image ref, provider URL, bun version, deploy time, and retention
 * deadline, and flips `status` back to `active` — reviving a version a prior prune had marked
 * `pruned` if it's rebuilt.
 */
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
