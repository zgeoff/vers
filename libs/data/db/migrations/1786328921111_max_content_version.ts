import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Adds `max_content_version` to `sim_versions`: the newest content version each engine build can
 * derive and replay, stamped ahead of a version's publish by the two-deploy rollout — no foreign
 * key to `content_versions`, since a row there can postdate the engine that already supports it.
 * Every existing row backfills to the live `content_current` pointer rather than a conservative
 * floor: a retained row already serves that content today, so stamping it any lower would refuse
 * the traffic it's already handling the moment the gate goes live. The next deploy-reconcile
 * refreshes the live engine's row with its actual bundled value. The default exists only for the
 * add-column step and is dropped after the backfill — every later writer must state the value, or
 * a silently defaulted row would be refused on its first start.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('sim_versions')
    .addColumn('max_content_version', 'text', (col) => col.notNull().defaultTo('1'))
    .execute();

  await sql`
    UPDATE sim_versions
    SET max_content_version = (SELECT content_version FROM content_current LIMIT 1)
    WHERE EXISTS (SELECT 1 FROM content_current)
  `.execute(db);

  await sql`ALTER TABLE sim_versions ALTER COLUMN max_content_version DROP DEFAULT`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('sim_versions').dropColumn('max_content_version').execute();
}
