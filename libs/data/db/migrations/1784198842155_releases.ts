import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('releases')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('app', 'text', (col) => col.notNull())
    .addColumn('git_sha', 'text', (col) => col.notNull())
    .addColumn('image', 'text', (col) => col.notNull())
    .addColumn('image_digest', 'text')
    .addColumn('deployed_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('releases_app_deployed_at_index')
    .on('releases')
    .columns(['app', 'deployed_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('releases').execute();
}
