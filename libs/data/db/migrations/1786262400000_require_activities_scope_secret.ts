import { sql } from 'kysely';
import type { Kysely } from 'kysely';

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

  await db.schema.alterTable('activities').dropConstraint('activities_secret_pair_check').execute();

  await db.schema
    .alterTable('activities')
    .alterColumn('secret_ref', (col) => col.setNotNull())
    .alterColumn('secret_version', (col) => col.setNotNull())
    .execute();
}

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
