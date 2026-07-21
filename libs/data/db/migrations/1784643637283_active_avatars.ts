import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Creates the `active_avatars` table: one row per user naming the avatar the account plays as.
 * Deleting the avatar cascades the row away — dropping the selection — and deleting the user
 * removes it with the account.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('active_avatars')
    .addColumn('user_id', 'text', (col) => col.primaryKey())
    .addColumn('avatar_id', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addForeignKeyConstraint(
      'active_avatars_user_id_users_id_fk',
      ['user_id'],
      'users',
      ['id'],
      (fk) => fk.onDelete('cascade').onUpdate('cascade'),
    )
    .addForeignKeyConstraint(
      'active_avatars_avatar_id_avatars_id_fk',
      ['avatar_id'],
      'avatars',
      ['id'],
      (fk) => fk.onDelete('cascade').onUpdate('cascade'),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('active_avatars').execute();
}
