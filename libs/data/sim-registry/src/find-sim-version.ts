import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { SimVersionRow } from './types';

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
