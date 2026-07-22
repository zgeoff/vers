import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Adds `settled_xp` to `activities` — the xp an activity has already contributed to its avatar's
 * settled row, advanced by the same guarded update that moves `verified_head`. It is an intent
 * ledger: the identity write floors at zero, so a debit larger than the avatar's settled total
 * lands smaller than the amount recorded here. Signed and unconstrained, because a failed run's
 * total is its accrued xp minus a death penalty computed against the avatar's lifetime progress,
 * which is routinely the larger of the two.
 *
 * The default of zero is what makes a run that is mid-flight at deploy come out whole: its
 * verified prefix settled nothing under the previous rule, and its terminal contributes the run
 * total minus this column, so the prefix is paid exactly once at the terminal. A row already
 * settled by a terminal checkpoint has no terminal left to true it up, so it is backfilled with
 * what it was paid — without that, re-verifying one would pay its total a second time.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activities')
    .addColumn('settled_xp', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();

  await sql`
    UPDATE activities
    SET settled_xp = (checkpoint.payload -> 'rewards' ->> 'xp')::integer
    FROM activity_checkpoints AS checkpoint
    WHERE checkpoint.activity_id = activities.id
      AND checkpoint.version = activities.appended_head
      AND activities.verified_head = activities.appended_head
      AND checkpoint.payload ->> 'type' IN ('completed', 'failed')
      AND jsonb_typeof(checkpoint.payload -> 'rewards' -> 'xp') = 'number'
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activities').dropColumn('settled_xp').execute();
}
