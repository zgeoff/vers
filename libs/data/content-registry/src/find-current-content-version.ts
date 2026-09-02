import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

export async function findCurrentContentVersion(db: Kysely<DB>): Promise<string | undefined> {
  const row = await db.selectFrom('contentCurrent').select('contentVersion').executeTakeFirst();

  return row?.contentVersion;
}
