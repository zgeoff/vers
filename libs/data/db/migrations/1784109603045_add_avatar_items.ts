import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('avatar_items')
    .addColumn('avatar_id', 'text', (col) => col.notNull())
    .addColumn('scope_type', 'text', (col) => col.notNull())
    .addColumn('scope_id', 'text', (col) => col.notNull())
    .addColumn('chain_index', 'integer', (col) => col.notNull())
    .addColumn('ordinal', 'integer', (col) => col.notNull())
    .addColumn('base_id', 'text', (col) => col.notNull())
    .addColumn('rarity_id', 'text', (col) => col.notNull())
    .addColumn('affixes', 'jsonb', (col) => col.notNull())
    .addColumn('content_version', 'text', (col) => col.notNull())
    .addColumn('key_version', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('avatar_items_pk', [
      'avatar_id',
      'scope_type',
      'scope_id',
      'chain_index',
      'ordinal',
    ])
    .addForeignKeyConstraint(
      'avatar_items_avatar_id_avatars_id_fk',
      ['avatar_id'],
      'avatars',
      ['id'],
      (fk) => fk.onDelete('cascade').onUpdate('cascade'),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('avatar_items').execute();
}
