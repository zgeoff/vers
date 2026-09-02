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
}

export async function down(): Promise<void> {}
