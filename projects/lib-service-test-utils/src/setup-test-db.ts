import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { migrateToLatest } from '@vers/db';

/**
 * Migrates the test template database by applying every `@vers/db` kysely
 * migration to an empty database.
 *
 * @param container - The testcontainers postgres container.
 */
export async function setupTestDB(container: StartedPostgreSqlContainer) {
  const connectionURI = container.getConnectionUri();

  const { error } = await migrateToLatest({ databaseURL: connectionURI });

  if (error !== undefined) {
    throw error instanceof Error ? error : new Error('kysely migration failed', { cause: error });
  }
}
