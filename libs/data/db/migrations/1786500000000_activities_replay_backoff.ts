import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activities')
    .addColumn('replay_backoff_until', 'timestamptz')
    .addColumn('replay_backoffs', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activities').dropColumn('replay_backoffs').execute();
  await db.schema.alterTable('activities').dropColumn('replay_backoff_until').execute();
}
