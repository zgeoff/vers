import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Adds the replay pipeline's schema: the activity head row gains the single-writer column
 * (`writer_session_id`, the one session allowed to append) and the poison-pill attempt counter, the
 * chain row gains the claim priority, and `avatar_grants` records one-shot grants (first-clears,
 * achievements, meta-unlocks) whose primary key is the grant-once rule itself. The partial index
 * serves the replay claim's pending-work scan (`appended_head > verified_head`).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activities').addColumn('writer_session_id', 'text').execute();

  await db.schema
    .alterTable('activities')
    .addColumn('replay_attempts', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();

  await db.schema
    .alterTable('activity_chains')
    .addColumn('priority', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();

  await db.schema
    .createTable('avatar_grants')
    .addColumn('avatar_id', 'text', (col) => col.notNull())
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('key', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('avatar_grants_pk', ['avatar_id', 'kind', 'key'])
    .addForeignKeyConstraint(
      'avatar_grants_avatar_id_avatars_id_fk',
      ['avatar_id'],
      'avatars',
      ['id'],
      (fk) => fk.onDelete('cascade').onUpdate('cascade'),
    )
    .execute();

  await db.schema
    .createIndex('activities_replay_pending_idx')
    .on('activities')
    .columns(['avatar_id', 'scope_type', 'scope_id', 'start_chain_index'])
    .where(sql.ref('appended_head'), '>', sql.ref('verified_head'))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('activities_replay_pending_idx').execute();
  await db.schema.dropTable('avatar_grants').execute();
  await db.schema.alterTable('activity_chains').dropColumn('priority').execute();
  await db.schema.alterTable('activities').dropColumn('replay_attempts').execute();
  await db.schema.alterTable('activities').dropColumn('writer_session_id').execute();
}
