import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('step_up_grants')
    .addColumn('token_hash', 'text', (col) => col.primaryKey())
    .addColumn('action', 'text', (col) => col.notNull())
    .addColumn('target', 'text', (col) => col.notNull())
    .addColumn('session_id', 'text', (col) => col.references('sessions.id').onDelete('cascade'))
    .addColumn('expires_at', 'timestamp', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('step_up_grants_expires_at_index')
    .on('step_up_grants')
    .column('expires_at')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('step_up_grants').execute();
}
