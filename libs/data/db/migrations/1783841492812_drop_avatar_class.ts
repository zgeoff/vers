import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Drops the `class` column from `avatars` and the `avatar_class` enum: avatar
 * creation is name-only, with no class premise left to model.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('avatars').dropColumn('class').execute();
  await db.schema.dropType('avatar_class').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.createType('avatar_class').asEnum(['brute', 'scoundrel', 'scholar']).execute();

  await db.schema
    .alterTable('avatars')
    .addColumn('class', sql`avatar_class`)
    .execute();
}
