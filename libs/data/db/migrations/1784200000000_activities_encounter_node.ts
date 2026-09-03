import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activities')
    .addColumn('encounter_node', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{"difficulty": 1}'::jsonb`),
    )
    .execute();

  await db.schema
    .alterTable('activities')
    .alterColumn('encounter_node', (col) => col.dropDefault())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activities').dropColumn('encounter_node').execute();
}
