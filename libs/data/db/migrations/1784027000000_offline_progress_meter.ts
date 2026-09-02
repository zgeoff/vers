import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('avatars')
    .addColumn('sim_budget_ms', 'bigint', (col) => col.notNull().defaultTo(300_000))
    .execute();

  await db.schema
    .alterTable('avatars')
    .addColumn('sim_metered_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .alterTable('activities')
    .addColumn('appended_time_ms', 'bigint', (col) => col.notNull().defaultTo(0))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activities').dropColumn('appended_time_ms').execute();
  await db.schema.alterTable('avatars').dropColumn('sim_metered_at').execute();
  await db.schema.alterTable('avatars').dropColumn('sim_budget_ms').execute();
}
