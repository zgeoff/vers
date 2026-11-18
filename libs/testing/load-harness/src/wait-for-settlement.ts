import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import * as z from 'zod';

const POLL_INTERVAL_MS = 1000;
const BacklogSchema = z.object({ unverified: z.coerce.number() });

// the end of play arrives as a `performance.now()` reading, not a wall-clock time
export async function waitForSettlement(
  db: Kysely<DB>,
  timeoutMs: number,
  stoppedAt: number,
): Promise<number | undefined> {
  const startedAt = performance.now();

  while (performance.now() - startedAt < timeoutMs) {
    const result = await sql`
      select coalesce(sum(appended_head - verified_head), 0) as unverified
      from activities
      where status not in ('parked', 'quarantined', 'rejected')
    `.execute(db);

    if (BacklogSchema.parse(result.rows[0]).unverified === 0) {
      return performance.now() - stoppedAt;
    }

    await Bun.sleep(Math.min(POLL_INTERVAL_MS, timeoutMs - (performance.now() - startedAt)));
  }

  return undefined;
}
