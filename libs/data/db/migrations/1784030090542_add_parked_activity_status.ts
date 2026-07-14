import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Adds `parked` to the `activity_status` enum: an operational hold on a replay job whose stamped
 * sim version the registry doesn't know, not a cheat signal. A parked activity does not block new
 * starts. Additive only — nothing in this migration writes the new value, so it is safe inside the
 * migrator's transaction.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TYPE activity_status ADD VALUE 'parked'`.execute(db);
}

/**
 * Postgres has no `DROP VALUE` for enums, so a parked-aware rollback would need to recreate the
 * type; left as a no-op since nothing in this migration's `up` writes the value.
 */
export async function down(): Promise<void> {}
