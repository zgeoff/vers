import type { DB, SimVersions } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockSimVersion } from './factories/create-mock-sim-version';

/**
 * Inserts a `sim_versions` row via kysely — needed to seed rows with a specific status,
 * `deployedAt`, or `retainedUntil` that the functions under test aren't themselves responsible for
 * producing.
 */
export function createSimVersionRow(
  db: Kysely<DB>,
  overrides: Partial<Insertable<SimVersions>> = {},
): Promise<Selectable<SimVersions>> {
  const row = createMockSimVersion(overrides);

  return db.insertInto('simVersions').values(row).returningAll().executeTakeFirstOrThrow();
}
