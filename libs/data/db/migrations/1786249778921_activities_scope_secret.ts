import type { Kysely } from 'kysely';

/**
 * Adds nullable `secret_ref` and `secret_version` to `activities`: the scope secret ref and root
 * version content sealing derived a row's node content from. No default and no backfill — every
 * row minted before sealing reads both as null, the verifier's legacy-row escape hatch.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activities')
    .addColumn('secret_ref', 'text')
    .addColumn('secret_version', 'integer')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activities')
    .dropColumn('secret_ref')
    .dropColumn('secret_version')
    .execute();
}
