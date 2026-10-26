import type { Kysely } from 'kysely';
import { sql } from 'kysely';

// the verifier claims each avatar's earliest pending activity across every scope; ordered by
// chain index, the claim stops at the first row that passes its ancestor check instead of checking
// every pending row of the avatar
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('activities_replay_claim_order_idx')
    .on('activities')
    .columns(['avatar_id', 'start_chain_index'])
    .where(sql.ref('appended_head'), '>', sql.ref('verified_head'))
    .execute();

  await db.schema.dropIndex('activities_replay_pending_idx').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('activities_replay_pending_idx')
    .on('activities')
    .columns(['avatar_id', 'scope_type', 'scope_id', 'start_chain_index'])
    .where(sql.ref('appended_head'), '>', sql.ref('verified_head'))
    .execute();

  await db.schema.dropIndex('activities_replay_claim_order_idx').execute();
}
