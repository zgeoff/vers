import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activities').addColumn('archived_at', 'timestamp').execute();

  await db.schema
    .createIndex('activities_archive_candidates_index')
    .on('activities')
    .column('verified_at')
    .where(sql.ref('archived_at'), 'is', null)
    .where(sql.ref('status'), 'in', ['stopped', 'capped'])
    .where(sql.ref('verified_head'), '=', sql.ref('appended_head'))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('activities_archive_candidates_index').execute();
  await db.schema.alterTable('activities').dropColumn('archived_at').execute();
}
