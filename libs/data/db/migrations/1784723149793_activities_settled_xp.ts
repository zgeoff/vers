import type { Kysely } from 'kysely';
import { sql } from 'kysely';

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
