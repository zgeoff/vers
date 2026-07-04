import type { Kysely } from 'kysely';

import type { DB } from '../src/schema.generated';

/**
 * Proves the seed workflow survives the move off drizzle: kysely-ctl runs
 * seed files with the same shape as migrations. Inserts a dev user carrying a
 * non-default game `seed` (the #125 column); idempotent via ON CONFLICT.
 */
export async function seed(db: Kysely<DB>): Promise<void> {
  await db
    .insertInto('users')
    .values({
      email: 'dev@vers.local',
      id: 'usr_dev_seed',
      name: 'Dev User',
      seed: 1337,
      username: 'dev',
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();
}
