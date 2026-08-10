import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Adds the `seed` column that mints each avatar's world-map geometry, defaulting it to a fresh
 * random value per row so the column both backfills existing avatars and stays compatible with a
 * currently-deployed avatar service whose create-avatar insert doesn't yet supply `seed` —
 * required expand/contract behavior for the window between this migration and cutover, and for any
 * later rollback to an image whose create-avatar insert predates the column. Purges the activity
 * graph first: every stamped encounter
 * descriptor was derived with `userSeed` pinned to 0, so replay recomputation against an avatar's
 * new random seed diverges on every row — the game carries ~0 players, so there is nothing worth
 * preserving. `avatar_items` is included because its primary key is the reward coordinate
 * `(avatar_id, scope_type, scope_id, chain_index, ordinal)` — truncating `activity_chains` resets
 * every chain's `chain_index` back to 0, and a stale mint row at a coordinate a fresh chain will
 * reach again would collide with its re-mint and silently block it. `avatars` itself keeps its
 * settled xp/level: the first activity a purged avatar starts borrows nothing ahead of
 * verification, since the optimistic-build read finds no unsettled activity rows left to fold in.
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

  await db.schema
    .alterTable('avatars')
    .addColumn('seed', 'integer', (col) =>
      col.notNull().defaultTo(sql`floor(random() * 2147483648)::int`),
    )
    .execute();
}

/**
 * Drops the column; truncated rows cannot be restored, so there is no data path back for the
 * purge.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('avatars').dropColumn('seed').execute();
}
