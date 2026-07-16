import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';

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

interface AggregateRow {
  readonly delta: number;
  readonly lag: number;
  readonly quarantined: number;
}

/**
 * One pass over the activity streams for the verification gauges: the age of the oldest
 * unverified append, the p95 appended-vs-verified head delta, the quarantined count, and the
 * parked backlog per sim version. A stream counts as unverified while appends sit past its
 * verified cursor and it hasn't been rejected — parked and quarantined streams stay in, since an
 * operator hold is exactly the staleness the lag gauge exists to show. Empty aggregates report 0.
 */
export async function loadVerificationSnapshot(db: Kysely<DB>): Promise<VerificationSnapshot> {
  const unverified = sql`appended_head > verified_head and status <> 'rejected'`;

  const aggregate = await sql<AggregateRow>`
    select
      coalesce(extract(epoch from (now() - min(appended_at) filter (where ${unverified})))::float8, 0) as lag,
      coalesce((percentile_cont(0.95) within group (order by appended_head - verified_head) filter (where ${unverified}))::float8, 0) as delta,
      (count(*) filter (where status = 'quarantined'))::int as quarantined
    from activities
  `.execute(db);

  const [row] = aggregate.rows;

  const parkedRows = await db
    .selectFrom('activities')
    .select(['simVersion', (eb) => eb.fn.countAll().as('count')])
    .where('status', '=', 'parked')
    .groupBy('simVersion')
    .execute();

  return {
    headDeltaP95: row?.delta ?? 0,
    lagSeconds: row?.lag ?? 0,
    parkedBySimVersion: parkedRows.map((parked) => ({
      count: Number(parked.count),
      simVersion: parked.simVersion,
    })),
    quarantinedCount: row?.quarantined ?? 0,
  };
}
