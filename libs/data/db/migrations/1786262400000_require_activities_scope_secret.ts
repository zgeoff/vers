import { sql } from 'kysely';
import type { Kysely } from 'kysely';

/**
 * Makes `secret_ref`/`secret_version` required: every activity row is sealed, so the verifier's
 * descriptor check has no unsealed row class to skip and the both-null-or-both-set check
 * constraint is vacuous. Purges the activity graph first — the pre-sealing rows read null in both
 * columns and cannot satisfy the constraint, and the game carries ~0 players, so there is nothing
 * worth preserving. `avatar_items` is included because its primary key is the reward coordinate
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

  await db.schema.alterTable('activities').dropConstraint('activities_secret_pair_check').execute();

  await db.schema
    .alterTable('activities')
    .alterColumn('secret_ref', (col) => col.setNotNull())
    .alterColumn('secret_version', (col) => col.setNotNull())
    .execute();
}

/**
 * Restores nullability and the pair constraint; truncated rows cannot be restored, so there is no
 * data path back.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activities')
    .alterColumn('secret_ref', (col) => col.dropNotNull())
    .alterColumn('secret_version', (col) => col.dropNotNull())
    .execute();

  await db.schema
    .alterTable('activities')
    .addCheckConstraint(
      'activities_secret_pair_check',
      sql`(secret_ref is null) = (secret_version is null)`,
    )
    .execute();
}
