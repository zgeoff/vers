import { sql } from 'kysely';
import type { Kysely } from 'kysely';

/**
 * Adds `predecessor_activity_id`, a plain nullable reference to the avatar's immediately-prior
 * activity, and `played_at`, an advisory client-stamped timestamp. Both columns are unbackfilled.
 * The reference carries no foreign key: the replay claim treats a predecessor row that is absent
 * the same as one not yet settled, so it waits rather than rejecting, and a check keeps a row from
 * naming itself. Drops `activity_snapshot_sources`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activities')
    .addColumn('predecessor_activity_id', 'text')
    .addColumn('played_at', 'timestamptz')
    .execute();

  await db.schema
    .alterTable('activities')
    .addCheckConstraint(
      'activities_predecessor_activity_id_not_self',
      sql`predecessor_activity_id <> id`,
    )
    .execute();

  await db.schema
    .createIndex('activities_predecessor_activity_id_index')
    .on('activities')
    .column('predecessor_activity_id')
    .execute();

  await db.schema.dropTable('activity_snapshot_sources').execute();
}

/**
 * Recreates `activity_snapshot_sources`, then drops the predecessor-order columns; unbackfilled
 * forward, so a rollback recovers the table shape but not its rows.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('activity_snapshot_sources')
    .addColumn('activity_id', 'text', (col) => col.notNull())
    .addColumn('source_activity_id', 'text', (col) => col.notNull())
    .addPrimaryKeyConstraint('activity_snapshot_sources_pk', ['activity_id', 'source_activity_id'])
    .addForeignKeyConstraint(
      'activity_snapshot_sources_activity_id_activities_id_fk',
      ['activity_id'],
      'activities',
      ['id'],
      (fk) => fk.onDelete('cascade').onUpdate('cascade'),
    )
    .addForeignKeyConstraint(
      'activity_snapshot_sources_source_activity_id_activities_id_fk',
      ['source_activity_id'],
      'activities',
      ['id'],
      (fk) => fk.onDelete('cascade').onUpdate('cascade'),
    )
    .execute();

  await db.schema
    .createIndex('activity_snapshot_sources_source_activity_id_idx')
    .on('activity_snapshot_sources')
    .column('source_activity_id')
    .execute();

  await db.schema.alterTable('activities').dropColumn('predecessor_activity_id').execute();
  await db.schema.alterTable('activities').dropColumn('played_at').execute();
}
