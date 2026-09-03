import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { ReleaseRow } from './types';

export function findLatestRelease(db: Kysely<DB>, app: string): Promise<ReleaseRow | undefined> {
  return db
    .selectFrom('releases')
    .selectAll()
    .where('app', '=', app)
    .orderBy('deployedAt', 'desc')
    .orderBy('id', 'desc')
    .limit(1)
    .executeTakeFirst();
}
