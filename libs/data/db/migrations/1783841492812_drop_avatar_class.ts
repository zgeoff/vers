import type { Kysely } from 'kysely';
import { sql } from 'kysely';

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
