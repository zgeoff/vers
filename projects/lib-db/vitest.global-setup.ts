import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { migrateToLatest } from './src/migrate-to-latest';

declare module 'vitest' {
  export interface ProvidedContext {
    dbURI: string;
    templateDB: string;
  }
}

/**
 * Starts (or reuses) the workspace's shared postgres test container, applies
 * every `@vers/db` kysely migration to the empty template database, then
 * publishes the connection URI to test files.
 */
export async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer('postgres:16.2-alpine3.19')
    .withDatabase('test_template')
    .withUsername('test')
    .withPassword('test')
    .withTmpFs({ '/var/lib/pg/data': 'rw' })
    .withEnvironment({ PGDATA: '/var/lib/pg/data' })
    .withExposedPorts({ container: 5432, host: 32_999 })
    .withReuse()
    .start();

  const connectionURI = container.getConnectionUri();

  const migrationResult = await migrateToLatest({ databaseURL: connectionURI });

  if (migrationResult.error !== undefined) {
    throw migrationResult.error instanceof Error
      ? migrationResult.error
      : new Error('kysely migration failed', { cause: migrationResult.error });
  }

  const dbURI = `postgres://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getFirstMappedPort()}`;

  project.provide('dbURI', dbURI);
  project.provide('templateDB', container.getDatabase());
}
