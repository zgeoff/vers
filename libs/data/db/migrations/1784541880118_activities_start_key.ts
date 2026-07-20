import type { Kysely } from 'kysely';

/**
 * Adds the nullable `start_key` column to `activities` — the idempotency key a start stamps on
 * the row it mints; rows minted without one never dedupe.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activities').addColumn('start_key', 'text').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activities').dropColumn('start_key').execute();
}
