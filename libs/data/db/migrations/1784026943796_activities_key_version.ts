import type { Kysely } from 'kysely';

/**
 * Adds `key_version` to `activities`, the key generation an activity's rolls derive under.
 * Defaults to 1 so existing rows read as the first generation.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activities')
    .addColumn('key_version', 'integer', (col) => col.notNull().defaultTo(1))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activities').dropColumn('key_version').execute();
}
