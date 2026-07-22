import type { Kysely } from 'kysely';

/**
 * Creates `activity_snapshot_sources`, one row per unverified run whose unsettled xp fed an
 * activity's `build_snapshot`. The verifier reads the stored snapshot as its simulation input
 * rather than re-deriving it, so a snapshot built from a run that later rejects would otherwise
 * verify clean against xp that never existed. The edges make that dependency queryable: an
 * activity is unclaimable while a source still has appends past its verified cursor, and a source
 * that rejected invalidates it.
 *
 * Edges are only ever walked from the dependent to its sources, so the primary key's leading
 * column serves every read and no reverse index exists.
 */
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
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('activity_snapshot_sources').execute();
}
