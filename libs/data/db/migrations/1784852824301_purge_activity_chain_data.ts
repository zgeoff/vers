import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Purges every activity, chain, checkpoint, and mint-at-settlement row: the start-hash canonical
 * field order excludes `activityID`, so a stream minted under the earlier format no longer
 * reproduces its own `start_hash`. The game carries ~0 players, so there is nothing worth
 * preserving. `avatar_items` is included because its primary key is the reward coordinate
 * `(avatar_id, scope_type, scope_id, chain_index, ordinal)` — truncating `activity_chains` resets
 * every chain's `chain_index` back to 0, and a stale mint row at a coordinate a fresh chain will
 * reach again would collide with its re-mint and silently block it. `avatars` itself is untouched:
 * its settled xp/level stays put, and the first activity a purged avatar starts borrows nothing
 * ahead of verification, since the optimistic-build read finds no unsettled activity rows left to
 * fold in.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    TRUNCATE TABLE
      activity_checkpoints,
      activity_snapshot_sources,
      avatar_items,
      activities,
      activity_chains
  `.execute(db);
}

/**
 * Truncated rows cannot be restored, so there is no data path back; the schema is unchanged in
 * both directions.
 */
export async function down(): Promise<void> {}
