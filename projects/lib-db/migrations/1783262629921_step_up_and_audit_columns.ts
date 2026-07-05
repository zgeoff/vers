import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Adds the step-up/audit surface consumed by the service-session port
 * (#154, #151): pending step-up transactions, a durable one-time-use token
 * ledger, refresh-token reuse detection, and a TOTP replay guard.
 *
 * Also installs a `set_updated_at()` trigger on `users`, `sessions`, and
 * `pending_transactions`. `users.updated_at` and `sessions.updated_at`
 * previously relied on drizzle's application-level `$onUpdate`, which this
 * trigger supersedes for every writer — kysely queries, ad-hoc SQL, and
 * cross-service writes alike.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('pending_transactions')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('action', 'text', (col) => col.notNull())
    .addColumn('target', 'text', (col) => col.notNull())
    .addColumn('ip_address', 'text', (col) => col.notNull())
    .addColumn('session_id', 'text', (col) => col.references('sessions.id').onDelete('cascade'))
    .addColumn('attempts', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('expires_at', 'timestamp', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('pending_transactions_expires_at_index')
    .on('pending_transactions')
    .column('expires_at')
    .execute();

  await db.schema
    .createTable('consumed_transaction_tokens')
    .addColumn('jti', 'text', (col) => col.primaryKey())
    .addColumn('expires_at', 'timestamp', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('consumed_transaction_tokens_expires_at_index')
    .on('consumed_transaction_tokens')
    .column('expires_at')
    .execute();

  await db.schema.alterTable('sessions').addColumn('previous_refresh_token', 'text').execute();

  await db.schema
    .alterTable('verifications')
    .addColumn('last_verified_code', 'text')
    .addColumn('last_verified_at', 'timestamp')
    .execute();

  await sql`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`
    CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `.execute(db);

  await sql`
    CREATE TRIGGER set_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `.execute(db);

  await sql`
    CREATE TRIGGER set_pending_transactions_updated_at
    BEFORE UPDATE ON pending_transactions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `.execute(db);
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS set_pending_transactions_updated_at ON pending_transactions`.execute(
    db,
  );

  await sql`DROP TRIGGER IF EXISTS set_sessions_updated_at ON sessions`.execute(db);
  await sql`DROP TRIGGER IF EXISTS set_users_updated_at ON users`.execute(db);
  await sql`DROP FUNCTION IF EXISTS set_updated_at()`.execute(db);

  await db.schema
    .alterTable('verifications')
    .dropColumn('last_verified_at')
    .dropColumn('last_verified_code')
    .execute();

  await db.schema.alterTable('sessions').dropColumn('previous_refresh_token').execute();

  await db.schema.dropTable('consumed_transaction_tokens').execute();
  await db.schema.dropTable('pending_transactions').execute();
}
