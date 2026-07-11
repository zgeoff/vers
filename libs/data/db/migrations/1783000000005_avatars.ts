import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Creates the `avatar_class` enum and the `avatars` table, one row per
 * player-created avatar.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.createType('avatar_class').asEnum(['brute', 'scoundrel', 'scholar']).execute();

  await db.schema
    .createTable('avatars')
    .addColumn('class', sql`avatar_class`, (col) => col.notNull())
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('level', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addColumn('xp', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('avatars_name_unique', ['name'])
    .addForeignKeyConstraint('avatars_user_id_users_id_fk', ['user_id'], 'users', ['id'], (fk) =>
      fk.onDelete('cascade').onUpdate('cascade'),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('avatars').execute();
  await db.schema.dropType('avatar_class').execute();
}
