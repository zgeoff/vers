import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Enforces at most one `verifications` row per `(target, type)` pair, closing the race where two
 * concurrent `createVerification` calls for the same target/type both insert instead of one
 * replacing the other. Dev/staging databases may already carry duplicates from that race, so the
 * dedup delete runs first, keeping only the newest row (by `created_at`, ties broken by `id`) per
 * pair.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM verifications
    WHERE id IN (
      SELECT id
      FROM (
        SELECT
          id,
          row_number() OVER (
            PARTITION BY target, type
            ORDER BY created_at DESC, id DESC
          ) AS rank
        FROM verifications
      ) ranked
      WHERE rank > 1
    )
  `.execute(db);

  await db.schema
    .alterTable('verifications')
    .addUniqueConstraint('verifications_target_type_unique', ['target', 'type'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('verifications')
    .dropConstraint('verifications_target_type_unique')
    .execute();
}
