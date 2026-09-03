import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // avatar_items is truncated with the chains: truncating activity_chains resets every chain_index
  // to 0, and a stale mint row at a coordinate a fresh chain reaches again would collide with its
  // re-mint under ON CONFLICT DO NOTHING and silently block it
  await sql`
    TRUNCATE TABLE
      activity_checkpoints,
      activity_snapshot_sources,
      avatar_items,
      activities,
      activity_chains
  `.execute(db);

  await db.schema
    .alterTable('avatars')
    .addColumn('seed', 'integer', (col) =>
      col.notNull().defaultTo(sql`floor(random() * 2147483648)::int`),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('avatars').dropColumn('seed').execute();
}
