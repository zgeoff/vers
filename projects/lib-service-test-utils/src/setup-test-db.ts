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

  const result = await migrateToLatest({ databaseURL: connectionURI });

  if (result.error !== undefined) {
    throw result.error instanceof Error
      ? result.error
      : new Error('kysely migration failed', { cause: result.error });
  }
}
