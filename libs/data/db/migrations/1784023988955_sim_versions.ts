import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Creates the `sim_versions` registry table, one row per built sim engine image keyed by its
 * content hash. `status` tracks whether the image is still deployable (`active`) or has aged out
 * of retention (`pruned`); `retained_until` is the earliest time a `pruned`-eligible row may be
 * removed.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('sim_versions')
    .addColumn('engine_hash', 'text', (col) => col.primaryKey())
    .addColumn('image_ref', 'text', (col) => col.notNull())
    .addColumn('provider_url', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) =>
      col
        .notNull()
        .defaultTo('active')
        .check(sql`status IN ('active', 'pruned')`),
    )
    .addColumn('retained_until', 'timestamptz', (col) => col.notNull())
    .addColumn('bun_version', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deployed_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('sim_versions').execute();
}
