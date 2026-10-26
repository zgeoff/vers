import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import * as z from 'zod';

const POLL_INTERVAL_MS = 1000;
const BacklogSchema = z.object({ unverified: z.coerce.number() });

// the time from the end of play, a `performance.now()` reading, until the verifier has proved every
// appended checkpoint, or undefined when the backlog outlives the timeout
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
