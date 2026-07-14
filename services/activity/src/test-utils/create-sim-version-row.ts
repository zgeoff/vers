import type { DB, SimVersions } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockSimVersionRow } from './factories/create-mock-sim-version-row';

/**
 * Persists a `sim_versions` row sourced from the factory's defaults — needed to seed a row with a
 * specific status, hash, or `retainedUntil` that `startActivity` itself never writes.
 */
export function createSimVersionRow(
  db: Kysely<DB>,
  overrides: Readonly<Partial<Insertable<SimVersions>>> = {},
): Promise<Selectable<SimVersions>> {
  return db
    .insertInto('simVersions')
    .values(createMockSimVersionRow(overrides))
    .returningAll()
    .executeTakeFirstOrThrow();
}
