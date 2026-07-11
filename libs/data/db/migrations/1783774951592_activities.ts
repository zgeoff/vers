import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Creates the `activity_status` enum, the `activities` head-row table (one row per activity
 * stream, carrying both the appended and verified cursors), and the append-only
 * `activity_checkpoints` table. `activity_checkpoints` is a plain table by design — time
 * partitioning is a later, separate change.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createType('activity_status')
    .asEnum(['active', 'stopped', 'rejected', 'capped', 'quarantined'])
    .execute();

  await db.schema
    .createTable('activities')
    .addColumn('appended_at', 'timestamp')
    .addColumn('appended_head', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('avatar_id', 'text', (col) => col.notNull())
    .addColumn('build_snapshot', 'jsonb', (col) => col.notNull())
    .addColumn('content_version', 'text', (col) => col.notNull())
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('last_hash', 'text', (col) => col.notNull())
    .addColumn('node_id', 'text', (col) => col.notNull())
    .addColumn('seed', 'text', (col) => col.notNull())
    .addColumn('sim_version', 'text', (col) => col.notNull())
    .addColumn('start_hash', 'text', (col) => col.notNull())
    .addColumn('started_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('status', sql`activity_status`, (col) => col.notNull().defaultTo('active'))
    .addColumn('stopped_at', 'timestamp')
    .addColumn('verified_at', 'timestamp')
    .addColumn('verified_head', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addForeignKeyConstraint(
      'activities_avatar_id_avatars_id_fk',
      ['avatar_id'],
      'avatars',
      ['id'],
      (fk) => fk.onDelete('cascade').onUpdate('cascade'),
    )
    .execute();

  await db.schema
    .createIndex('activities_avatar_id_index')
    .on('activities')
    .column('avatar_id')
    .execute();

  // Partial: only one row per avatar may be `active` at a time. Non-active rows (stopped,
  // rejected, capped, quarantined) are exempt, so an avatar can start a new activity once its
  // previous one has ended.
  await db.schema
    .createIndex('activities_avatar_id_active_unique')
    .on('activities')
    .unique()
    .column('avatar_id')
    .where(sql.ref('status'), '=', 'active')
    .execute();

  await sql`
    CREATE TRIGGER set_activities_updated_at
    BEFORE UPDATE ON activities
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `.execute(db);

  // Append-only: no `updated_at`, no trigger. Deliberately not partitioned — a single plain
  // table with no inbound foreign keys and no reliance on a global unique constraint, so
  // partitioning it later is a storage change, not a contract change.
  await db.schema
    .createTable('activity_checkpoints')
    .addColumn('activity_id', 'text', (col) => col.notNull())
    .addColumn('appended_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('hash', 'text', (col) => col.notNull())
    .addColumn('payload', 'jsonb', (col) => col.notNull())
    .addColumn('prev_hash', 'text', (col) => col.notNull())
    .addColumn('version', 'integer', (col) => col.notNull())
    .addPrimaryKeyConstraint('activity_checkpoints_pk', ['activity_id', 'version'])
    .addForeignKeyConstraint(
      'activity_checkpoints_activity_id_activities_id_fk',
      ['activity_id'],
      'activities',
      ['id'],
      (fk) => fk.onDelete('cascade').onUpdate('cascade'),
    )
    .execute();

  await db.schema
    .createIndex('activity_checkpoints_appended_at_index')
    .on('activity_checkpoints')
    .column('appended_at')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('activity_checkpoints').execute();
  await sql`DROP TRIGGER IF EXISTS set_activities_updated_at ON activities`.execute(db);
  await db.schema.dropTable('activities').execute();
  await db.schema.dropType('activity_status').execute();
}
