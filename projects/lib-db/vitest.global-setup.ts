import path from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import * as schema from '@vers/postgres-schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
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
 * the drizzle baseline (`db-postgres/migrations`) followed by this package's
 * own kysely migrations, then publishes the connection URI to test files.
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

  const drizzleClient = postgres(connectionURI);

  await migrate(drizzle(drizzleClient, { schema }), {
    migrationsFolder: path.join(import.meta.dirname, '../db-postgres/migrations'),
  });

  await drizzleClient.end();

  const { error } = await migrateToLatest({ databaseURL: connectionURI });

  if (error !== undefined) {
    throw error instanceof Error ? error : new Error('kysely migration failed', { cause: error });
  }

  const dbURI = `postgres://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getFirstMappedPort()}`;

  project.provide('dbURI', dbURI);
  project.provide('templateDB', container.getDatabase());
}
