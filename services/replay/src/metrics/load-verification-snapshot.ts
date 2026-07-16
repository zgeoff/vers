import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';

interface ParkedBacklogEntry {
  readonly count: number;
  readonly simVersion: string;
}

export interface VerificationSnapshot {
  readonly headDeltaP95: number;
  readonly lagSeconds: number;
  readonly parkedBySimVersion: ReadonlyArray<ParkedBacklogEntry>;
  readonly quarantinedCount: number;
}

/**
 * One statement over the activity streams for the verification gauges — a single consistent
 * snapshot of the age of the oldest unverified append, the p95 appended-vs-verified head delta,
 * the quarantined count, and the parked backlog per sim version. A stream counts as unverified
 * while appends sit past its verified cursor and it hasn't been rejected — parked and quarantined
 * streams stay in, since an operator hold is exactly the staleness the lag gauge exists to show.
 * Empty aggregates report 0.
 */
export async function loadVerificationSnapshot(db: Kysely<DB>): Promise<VerificationSnapshot> {
  const row = await db
    .selectFrom('activities')
    .select((eb) => {
      const unverified = eb.and([
        eb('appendedHead', '>', eb.ref('verifiedHead')),
        eb('status', '<>', 'rejected'),
      ]);

      const oldestUnverified = eb.fn.min('appendedAt').filterWhere(unverified);

      // `extract(epoch from …)` and `percentile_cont`'s within-group ordering have no builder
      // API; the fragments embed builder expressions so column names stay plugin-translated
      return [
        eb.fn
          .coalesce(
            sql<number>`extract(epoch from (now() - ${oldestUnverified}))::float8`,
            sql<number>`0`,
          )
          .as('lag'),
        eb.fn
          .coalesce(
            sql<number>`(percentile_cont(0.95) within group (order by ${eb.ref('appendedHead')} - ${eb.ref('verifiedHead')}) filter (where ${unverified}))::float8`,
            sql<number>`0`,
          )
          .as('delta'),
        eb
          .cast<number>(eb.fn.countAll().filterWhere('status', '=', 'quarantined'), 'integer')
          .as('quarantined'),
        jsonArrayFrom(
          eb
            .selectFrom('activities as parked')
            .select((pb) => [
              'parked.simVersion',
              pb.cast<number>(pb.fn.countAll(), 'integer').as('count'),
            ])
            .where('parked.status', '=', 'parked')
            .groupBy('parked.simVersion'),
        ).as('parked'),
      ];
    })
    .executeTakeFirst();

  return {
    headDeltaP95: row?.delta ?? 0,
    lagSeconds: row?.lag ?? 0,
    parkedBySimVersion: row?.parked ?? [],
    quarantinedCount: row?.quarantined ?? 0,
  };
}
