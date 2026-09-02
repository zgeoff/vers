import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activities')
    .addColumn('secret_ref', 'text')
    .addColumn('secret_version', 'integer')
    .execute();

  await db.schema
    .alterTable('activities')
    .addCheckConstraint(
      'activities_secret_pair_check',
      sql`(secret_ref is null) = (secret_version is null)`,
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('activities')
    .dropColumn('secret_ref')
    .dropColumn('secret_version')
    .execute();
}
