import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import * as z from 'zod';

const VerifiedHeadRowSchema = z.object({
  id: z.string(),
  sampledAt: z.string(),
  verifiedHead: z.coerce.number(),
});

const AgeRowSchema = z.object({ ageMs: z.coerce.number() });

// a segment apply stamps its transaction's start, before its replay work and its commit, so a
// checkpoint's age runs from its append to the first read whose statement sees it proved; both
// stamps are zone-less timestamps in the session zone, so the read time returns as text
export function makeReadVerifiedAges(db: Kysely<DB>): () => Promise<Array<number>> {
  const heads = new Map<string, number>();

  let primed = false;

  return async () => {
    const sample = await sql`
      select
        id,
        verified_head as "verifiedHead",
        statement_timestamp()::timestamp::text as "sampledAt"
      from activities
      where verified_head > 0
    `.execute(db);

    const rows = z.array(VerifiedHeadRowSchema).parse(sample.rows);
    const ranges = primed ? rows.filter((row) => row.verifiedHead > (heads.get(row.id) ?? 0)) : [];
    const afterVersions = ranges.map((row) => heads.get(row.id) ?? 0);

    for (const row of rows) {
      heads.set(row.id, row.verifiedHead);
    }

    primed = true;

    const [first] = ranges;

    if (first === undefined) {
      return [];
    }

    const activityIDs = ranges.map((row) => row.id);
    const toVersions = ranges.map((row) => row.verifiedHead);

    const result = await sql`
      select extract(epoch from ${first.sampledAt}::timestamp - c.appended_at) * 1000 as "ageMs"
      from unnest(${activityIDs}::text[], ${afterVersions}::int[], ${toVersions}::int[])
        as range(id, after_version, to_version)
      join activity_checkpoints c
        on c.activity_id = range.id
        and c.version > range.after_version
        and c.version <= range.to_version
    `.execute(db);

    return z
      .array(AgeRowSchema)
      .parse(result.rows)
      .map((row) => row.ageMs);
  };
}
