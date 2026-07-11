import type { Kysely } from 'kysely';

/**
 * Indexes `sessions.user_id` — both the verify-time eviction delete and
 * `getSessions` filter on it and would otherwise seq-scan.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.createIndex('sessions_user_id_index').on('sessions').column('user_id').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('sessions_user_id_index').execute();
}
