import { sql } from 'kysely';
import type { Kysely } from 'kysely';

/**
 * Adds nullable `secret_ref` and `secret_version` to `activities`: the scope secret ref and root
 * version content sealing derived a row's node content from. No default and no backfill — every
 * row minted before sealing reads both as null, the verifier's legacy-row escape hatch. A check
 * constraint admits the pair only as both-null or both-set: a row carrying one without the other
 * could slip past the verifier's legacy-row gate, which keys on `secret_ref` alone.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activities')
    .addColumn('secret_ref', 'text')
    .addColumn('secret_version', 'integer')
    .execute();

  await db.schema
    .alterTable('activities')
    .addCheckConstraint(
      'activities_secret_pair_check',
      sql`(secret_ref is null) = (secret_version is null)`,
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activities')
    .dropColumn('secret_ref')
    .dropColumn('secret_version')
    .execute();
}
