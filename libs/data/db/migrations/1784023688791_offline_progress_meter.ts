import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Adds the offline-progress meter: the avatar accrues simulated-time budget at wall-clock rate
 * (elapsed since `sim_metered_at`, banked into `sim_budget_ms` up to the configured cap) and every
 * accepted checkpoint append consumes its simulated-time delta from that balance. The default
 * balance is a one-time grant covering client sim jitter — live play refills as fast as it
 * consumes, so the balance never grows past it while online. `appended_time_ms` mirrors the last
 * appended checkpoint's cumulative `time` onto the activity head row, so the append path computes a
 * batch's delta without reading the checkpoints table.
 */
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
