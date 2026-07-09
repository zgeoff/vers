import '@zgeoff/bun-test-extended';
import { connect } from 'node:net';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { migrateToLatest } from './src/migrate-to-latest';

const TEST_CONTAINER_PORT = 32_999;
const TEST_TEMPLATE_DB = 'test_template';

// a bun-test file's preload runs once per file's process, so cross-file
// handoff of the container's connection details needs an env var rather
// than an in-memory value (`resolveTestDBTarget` reads it back per file)
if (process.env['TEST_DB_URI'] === undefined) {
  if (await isTestContainerReachable()) {
    process.env['TEST_DB_URI'] = `postgres://test:test@localhost:${TEST_CONTAINER_PORT}`;
    process.env['TEST_TEMPLATE_DB'] = TEST_TEMPLATE_DB;
  } else {
    const container = await createPostgresContainer();

    const migrationResult = await migrateToLatest({ databaseURL: container.getConnectionUri() });

    if (migrationResult.error !== undefined) {
      throw migrationResult.error instanceof Error
        ? migrationResult.error
        : new Error('kysely migration failed', { cause: migrationResult.error });
    }

    process.env['TEST_DB_URI'] =
      `postgres://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getFirstMappedPort()}`;

    process.env['TEST_TEMPLATE_DB'] = container.getDatabase();
  }
}

/**
 * Checks whether the shared postgres test container (started by
 * `pg:test-container:start`, or a previous run's leftover `withReuse`
 * container) is already listening — short-circuiting the container
 * startup below whenever it is.
 */
function isTestContainerReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: 'localhost', port: TEST_CONTAINER_PORT, timeout: 1000 });

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function createPostgresContainer(): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer('postgres:16.2-alpine3.19')
    .withDatabase(TEST_TEMPLATE_DB)
    .withUsername('test')
    .withPassword('test')
    .withTmpFs({ '/var/lib/pg/data': 'rw' })
    .withEnvironment({ PGDATA: '/var/lib/pg/data' })
    .withExposedPorts({ container: 5432, host: TEST_CONTAINER_PORT })
    .withReuse()
    .start();
}
