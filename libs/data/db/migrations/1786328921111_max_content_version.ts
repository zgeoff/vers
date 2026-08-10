import type { Kysely } from 'kysely';

/**
 * Adds `max_content_version` to `sim_versions`: the newest content version each engine build can
 * derive and replay, stamped ahead of a version's publish by the two-deploy rollout — no foreign
 * key to `content_versions`, since a row there can postdate the engine that already supports it.
 * The `'1'` default conservatively backfills every existing row; the next deploy-reconcile refreshes
 * the live engine's row with its actual bundled value.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('sim_versions')
    .addColumn('max_content_version', 'text', (col) => col.notNull().defaultTo('1'))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('sim_versions').dropColumn('max_content_version').execute();
}
