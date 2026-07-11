import type { Kysely } from 'kysely';
import type { DB } from '../src/schema.generated';

/**
 * Seeds a dev user for local development. Runs on every `kysely seed run`
 * invocation — kysely-ctl has no seed bookkeeping — so this is idempotent
 * via `ON CONFLICT DO NOTHING`.
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
