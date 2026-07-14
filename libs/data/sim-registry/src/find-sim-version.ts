import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { SimVersionRow } from './types';

/**
 * Looks up the `sim_versions` row for a given engine hash — undefined when no image has been
 * registered for that hash.
 */
export function findSimVersion(
  db: Kysely<DB>,
  engineHash: string,
): Promise<SimVersionRow | undefined> {
  return db
    .selectFrom('simVersions')
    .selectAll()
    .where('engineHash', '=', engineHash)
    .executeTakeFirst();
}
