import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activity_chains')
    .addColumn('replay_pending', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();

  await sql`
    update activity_chains as chain
    set replay_pending = true
    where exists (
      select 1
      from activities
      where activities.avatar_id = chain.avatar_id
        and activities.scope_type = chain.scope_type
        and activities.scope_id = chain.scope_id
        and activities.appended_head > activities.verified_head
        and activities.status <> 'rejected'
    )
  `.execute(db);

  await db.schema
    .createIndex('activity_chains_replay_claim_order_idx')
    .on('activity_chains')
    .columns(['priority desc', 'created_at'])
    .where(sql.ref('replay_pending'), '=', true)
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('activity_chains_replay_claim_order_idx').execute();
  await db.schema.alterTable('activity_chains').dropColumn('replay_pending').execute();
}
