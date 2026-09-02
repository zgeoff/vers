import type { Kysely } from 'kysely';
import type { DB } from '../src/schema.generated';

// kysely-ctl has no seed bookkeeping, so this runs on every seed invocation and stays idempotent
// through the conflict clause
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
