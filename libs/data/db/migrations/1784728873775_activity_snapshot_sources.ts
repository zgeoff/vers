import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
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
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('activity_snapshot_sources').execute();
}
