import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { SimVersionRow } from '../types';
import { createMockSimVersionRow } from './factories/create-mock-sim-version-row';

/**
 * Inserts a `sim_versions` row via kysely — needed to seed rows with a specific status,
 * `deployedAt`, or `retainedUntil` that the functions under test aren't themselves responsible for
 * producing.
 */
export function createSimVersionRow(
  db: Kysely<DB>,
  overrides: Readonly<Partial<SimVersionRow>> = {},
): Promise<SimVersionRow> {
  return db
    .insertInto('simVersions')
    .values(createMockSimVersionRow(overrides))
    .returningAll()
    .executeTakeFirstOrThrow();
}
