import type { Kysely } from 'kysely';
import { sql } from 'kysely';

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

export async function down(): Promise<void> {}
