import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Creates the `avatar_mode` enum and adds the `mode` column to `avatars`, defaulted to `trade`
 * for every existing row.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.createType('avatar_mode').asEnum(['trade', 'self_found']).execute();

  await db.schema
    .alterTable('avatars')
    .addColumn('mode', sql`avatar_mode`, (col) => col.notNull().defaultTo('trade'))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('avatars').dropColumn('mode').execute();
  await db.schema.dropType('avatar_mode').execute();
}
