import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.createType('activity_failure_action').asEnum(['abort', 'retry']).execute();

  await db.schema
    .alterTable('avatars')
    .addColumn('failure_action', sql`activity_failure_action`, (col) =>
      col.notNull().defaultTo('abort'),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('avatars').dropColumn('failure_action').execute();
  await db.schema.dropType('activity_failure_action').execute();
}
