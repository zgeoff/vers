import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('sessions').addColumn('rotation_grace_until', 'timestamp').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('sessions').dropColumn('rotation_grace_until').execute();
}
