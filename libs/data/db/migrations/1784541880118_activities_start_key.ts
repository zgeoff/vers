import type { Kysely } from 'kysely';

/**
 * Adds the nullable `start_key` column to `activities`: the caller-supplied idempotency key a
 * start request stamps on the row it mints, so a duplicate delivery of the same start returns the
 * existing row instead of a conflict. Nullable — rows minted without a key never dedupe.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activities').addColumn('start_key', 'text').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activities').dropColumn('start_key').execute();
}
