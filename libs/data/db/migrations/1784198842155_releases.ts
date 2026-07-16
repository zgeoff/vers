import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Creates the `releases` table, one row per app rollout that passed its post-deploy probes.
 * `image` is the registry ref the rollout cut over to (tag form, deployable as-is), and
 * `image_digest` is the digest the fleet resolved it to — null when the fleet had no single
 * resolved image at record time. The newest row per app is the rollback target for that app's
 * next failed deploy.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('releases')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('app', 'text', (col) => col.notNull())
    .addColumn('git_sha', 'text', (col) => col.notNull())
    .addColumn('image', 'text', (col) => col.notNull())
    .addColumn('image_digest', 'text')
    .addColumn('deployed_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('releases_app_deployed_at_index')
    .on('releases')
    .columns(['app', 'deployed_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('releases').execute();
}
