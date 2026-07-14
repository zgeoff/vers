import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { SimVersionRow } from './types';

/**
 * Finds the version new activities should launch against: the newest `active` row by
 * `deployedAt`. Undefined when no version is active.
 */
export function findCurrentSimVersion(db: Kysely<DB>): Promise<SimVersionRow | undefined> {
  return db
    .selectFrom('simVersions')
    .selectAll()
    .where('status', '=', 'active')
    .orderBy('deployedAt', 'desc')
    .limit(1)
    .executeTakeFirst();
}
