import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import * as schema from '@vers/postgres-schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

interface TestDBConfig {
  migrationsFolder?: string;
}

const packageDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Migrates the test template database.
 *
 * @param container - The testcontainers postgres container.
 */
export async function setupTestDB(
  container: StartedPostgreSqlContainer,
  config: TestDBConfig = {},
) {
  const client = postgres(container.getConnectionUri());
  const db = drizzle(client, { schema });

  const migrationsFolder =
    config.migrationsFolder ??
    path.join(packageDir, '../../db-postgres/migrations');

  await migrate(db, { migrationsFolder });

  await client.end();
}
