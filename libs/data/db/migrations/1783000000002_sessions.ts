import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Creates the `sessions` table, one row per authenticated session, tracking
 * refresh-token rotation state (`refresh_token`/`previous_refresh_token`)
 * and step-up verification (`verified`).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('sessions')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addColumn('ip_address', 'text', (col) => col.notNull())
    .addColumn('refresh_token', 'text')
    .addColumn('expires_at', 'timestamp', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('verified', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('previous_refresh_token', 'text')
    .addForeignKeyConstraint('sessions_user_id_users_id_fk', ['user_id'], 'users', ['id'], (fk) =>
      fk.onDelete('cascade').onUpdate('cascade'),
    )
    .execute();

  await sql`
    CREATE TRIGGER set_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS set_sessions_updated_at ON sessions`.execute(db);
  await db.schema.dropTable('sessions').execute();
}
