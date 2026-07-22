import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Adds the nullable `parked_from` column to `activities` — the status a row held when it parked,
 * so the unpark sweep restores that status rather than assuming `active`. Null on a row parked
 * before this column existed, which only `active` rows could reach.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activities')
    .addColumn('parked_from', sql`activity_status`)
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activities').dropColumn('parked_from').execute();
}
