import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Creates the step-up transaction surface: a durable pending-transaction
 * table for step-up confirmation flows, and a one-time-use token ledger
 * that blocks replay of consumed step-up tokens.
 */
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

  await sql`
    CREATE TRIGGER set_pending_transactions_updated_at
    BEFORE UPDATE ON pending_transactions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS set_pending_transactions_updated_at ON pending_transactions`.execute(
    db,
  );

  await db.schema.dropTable('consumed_transaction_tokens').execute();
  await db.schema.dropTable('pending_transactions').execute();
}
