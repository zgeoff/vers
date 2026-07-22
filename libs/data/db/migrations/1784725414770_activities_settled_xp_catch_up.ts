import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Backfills `settled_xp` for activities that settled a terminal checkpoint while the column
 * existed but nothing advanced it — the window between the column landing and the verifier
 * beginning to write it. Those rows are fully verified, so no later terminal trues them up, and a
 * cursor rewound by hand would otherwise pay their total a second time. Idempotent: it only
 * touches rows still at zero.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE activities
    SET settled_xp = (checkpoint.payload -> 'rewards' ->> 'xp')::integer
    FROM activity_checkpoints AS checkpoint
    WHERE checkpoint.activity_id = activities.id
      AND checkpoint.version = activities.appended_head
      AND activities.verified_head = activities.appended_head
      AND activities.settled_xp = 0
      AND checkpoint.payload ->> 'type' IN ('completed', 'failed')
      AND jsonb_typeof(checkpoint.payload -> 'rewards' -> 'xp') = 'number'
  `.execute(db);
}

/**
 * The column's own migration owns dropping it; a value written here is indistinguishable from one
 * the verifier wrote, so there is nothing to reverse.
 */
export async function down(): Promise<void> {}
