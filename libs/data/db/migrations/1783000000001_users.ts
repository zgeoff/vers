import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await db.schema
    .createTable('users')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('username', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('password_hash', 'text')
    .addColumn('password_reset_token', 'text')
    .addColumn('password_reset_token_expires_at', 'timestamp')
    .addColumn('seed', 'integer', (col) => col.notNull().defaultTo(0))
    .addUniqueConstraint('users_email_unique', ['email'])
    .addUniqueConstraint('users_username_unique', ['username'])
    .execute();

  await sql`
    CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS set_users_updated_at ON users`.execute(db);
  await db.schema.dropTable('users').execute();
  await sql`DROP FUNCTION IF EXISTS set_updated_at()`.execute(db);
}
