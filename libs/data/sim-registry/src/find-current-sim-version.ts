import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { SimVersionRow } from './types';

export function findCurrentSimVersion(db: Kysely<DB>): Promise<SimVersionRow | undefined> {
  return db
    .selectFrom('simVersions')
    .selectAll()
    .where('status', '=', 'active')
    .orderBy('deployedAt', 'desc')
    .orderBy('engineHash', 'desc')
    .limit(1)
    .executeTakeFirst();
}
