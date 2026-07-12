import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Creates `activity_chains`, one row per (avatar, node) holding the genesis seed and the two
 * derivation anchors: `appended_*` is the source for the next activity's seed derivation,
 * `verified_*` is the settlement watermark it advances to once outcomes are confirmed.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('activity_chains')
    .addColumn('avatar_id', 'text', (col) => col.notNull())
    .addColumn('node_id', 'text', (col) => col.notNull())
    .addColumn('genesis_seed', 'text', (col) => col.notNull())
    .addColumn('appended_next_seed', 'text', (col) => col.notNull())
    .addColumn('appended_chain_index', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('verified_next_seed', 'text', (col) => col.notNull())
    .addColumn('verified_chain_index', 'integer', (col) => col.notNull().defaultTo(0))

    // Deliberately no `updated_at` column and no on-update trigger — a later reveal upsert
    // self-assigns `genesis_seed` and must not bump a timestamp.
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))

    // Deliberately no `mode` column — economy-mode key custody is a separate concern, owned by
    // the economy-mode partitioning rather than the seed chain.
    .addPrimaryKeyConstraint('activity_chains_pk', ['avatar_id', 'node_id'])
    .addForeignKeyConstraint(
      'activity_chains_avatar_id_avatars_id_fk',
      ['avatar_id'],
      'avatars',
      ['id'],
      (fk) => fk.onDelete('cascade').onUpdate('cascade'),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('activity_chains').execute();
}
