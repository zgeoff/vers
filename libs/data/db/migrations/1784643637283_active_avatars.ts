import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('avatars')
    .addUniqueConstraint('avatars_id_user_id_unique', ['id', 'user_id'])
    .execute();

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
      'active_avatars_avatar_id_user_id_avatars_fk',
      ['avatar_id', 'user_id'],
      'avatars',
      ['id', 'user_id'],
      (fk) => fk.onDelete('cascade').onUpdate('cascade'),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('active_avatars').execute();
  await db.schema.alterTable('avatars').dropConstraint('avatars_id_user_id_unique').execute();
}
