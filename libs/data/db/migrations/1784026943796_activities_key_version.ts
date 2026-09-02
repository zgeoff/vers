import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activities')
    .addColumn('key_version', 'integer', (col) => col.notNull().defaultTo(1))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activities').dropColumn('key_version').execute();
}
