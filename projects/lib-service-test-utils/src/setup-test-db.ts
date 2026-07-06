import path from 'node:path';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { migrateToLatest } from '@vers/db';
import * as schema from '@vers/postgres-schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

interface TestDBConfig {
  readonly migrationsFolder?: string;
}

const packageDir = import.meta.dirname;

/**
 * Migrates the test template database: the frozen drizzle baseline
 * (`db-postgres/migrations`), then `@vers/db`'s kysely migrations. This order
 * holds everywhere the template database is prepared — drizzle 0000–0011
 * always runs before any kysely migration.
 *
 * @param container - The testcontainers postgres container.
 */
export async function setupTestDB(
  container: StartedPostgreSqlContainer,
  config: TestDBConfig = {},
) {
  const connectionURI = container.getConnectionUri();

  const client = postgres(connectionURI);
  const db = drizzle(client, { schema });

  const migrationsFolder =
    config.migrationsFolder ?? path.join(packageDir, '../../db-postgres/migrations');

  await migrate(db, { migrationsFolder });

  await client.end();

  const { error } = await migrateToLatest({ databaseURL: connectionURI });

  if (error !== undefined) {
    throw error instanceof Error ? error : new Error('kysely migration failed', { cause: error });
  }
}
