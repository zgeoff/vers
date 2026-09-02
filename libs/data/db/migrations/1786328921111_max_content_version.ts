import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('sim_versions')
    .addColumn('max_content_version', 'text', (col) => col.notNull().defaultTo('1'))
    .execute();

  await sql`
    UPDATE sim_versions
    SET max_content_version = (SELECT content_version FROM content_current LIMIT 1)
    WHERE EXISTS (SELECT 1 FROM content_current)
  `.execute(db);

  await sql`ALTER TABLE sim_versions ALTER COLUMN max_content_version DROP DEFAULT`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('sim_versions').dropColumn('max_content_version').execute();
}
