import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

/**
 * Reads the content version new activities should launch against, from the single-row pointer.
 * Undefined only before the registry has ever been seeded.
 */
export async function findCurrentContentVersion(db: Kysely<DB>): Promise<string | undefined> {
  const row = await db.selectFrom('contentCurrent').select('contentVersion').executeTakeFirst();

  return row?.contentVersion;
}
