import type { Kysely } from 'kysely';

/**
 * Adds the activity's starting position on its (avatar,node) chain; the client derives each
 * checkpoint's chainIndex as startChainIndex + version.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activities')
    .addColumn('start_chain_index', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activities').dropColumn('start_chain_index').execute();
}
