import type { DB } from '@vers/db';
import { buildXPThreshold } from '@vers/idle-core';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import * as z from 'zod';
import type { LoadPlayerAccount, Reconciliation } from './types';

const TotalsSchema = z.object({
  activities: z.coerce.number(),
  checkpoints: z.coerce.number(),
  held: z.coerce.number(),
  simulatedMs: z.coerce.number(),
  unverified: z.coerce.number(),
});

const OutcomeRowSchema = z.object({ count: z.coerce.number(), outcome: z.string() });

const AvatarRowSchema = z.object({
  id: z.string(),
  settled: z.coerce.number(),
  xp: z.coerce.number(),
});

// the end state a run must leave: every appended checkpoint proved, no activity held or rejected,
// each delivered run settled at the XP its own stream earned, and each avatar's XP equal to its
// seeded XP plus what its activities settled
export async function readReconciliation(
  db: Kysely<DB>,
  accounts: ReadonlyArray<LoadPlayerAccount>,
  expectedXP: ReadonlyMap<string, number>,
): Promise<Reconciliation> {
  const totals = await sql`
    select
      count(*) as activities,
      coalesce(sum(appended_head), 0) as checkpoints,
      coalesce(sum(appended_head - verified_head), 0) as unverified,
      coalesce(sum(appended_time_ms), 0) as "simulatedMs",
      count(*) filter (where status in ('parked', 'quarantined', 'rejected')) as held
    from activities
  `.execute(db);

  const outcomes = await sql`
    select payload->>'type' as outcome, count(*) as count
    from activity_checkpoints
    where payload->>'type' in ('completed', 'failed')
    group by 1
  `.execute(db);

  const avatars = await sql`
    select avatars.id, avatars.xp, coalesce(sum(activities.settled_xp), 0) as settled
    from avatars
    left join activities on activities.avatar_id = avatars.id
    group by avatars.id, avatars.xp
  `.execute(db);

  const settledRuns =
    expectedXP.size === 0
      ? []
      : await db
          .selectFrom('activities')
          .select(['id', 'settledXp'])
          .where('id', 'in', [...expectedXP.keys()])
          .execute();

  const seededXP = new Map(
    accounts.map((account) => [account.avatarID, buildXPThreshold(account.profile.level)]),
  );

  const avatarRows = z.array(AvatarRowSchema).parse(avatars.rows);
  const outcomeRows = z.array(OutcomeRowSchema).parse(outcomes.rows);

  return {
    ...TotalsSchema.parse(totals.rows[0]),
    avatarXPMismatches: avatarRows.filter(
      (avatar) => avatar.xp !== (seededXP.get(avatar.id) ?? 0) + avatar.settled,
    ).length,
    outcomes: Object.fromEntries(outcomeRows.map((row) => [row.outcome, row.count])),
    runXPMismatches: settledRuns.filter((run) => run.settledXp !== expectedXP.get(run.id)).length,
  };
}
