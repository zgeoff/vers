import '@zgeoff/bun-test-extended';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { registerBunTestCleanup } from '@vers/test-utils/bun';
import { buildTestTemplateDBName } from './src/test-support/build-test-template-db-name';
import { createTestTemplate } from './src/test-support/create-test-template';
import { isTestContainerReachable } from './src/test-support/is-test-container-reachable';
import { readCurrentBranch } from './src/test-support/read-current-branch';

registerBunTestCleanup();

const TEST_CONTAINER_PORT = 32_999;
const TEST_TEMPLATE_DB = 'test_template';

// a bun-test file's preload runs once per file's process, so cross-file
// handoff of the container's connection details needs an env var rather
// than an in-memory value (`resolveTestDBTarget` reads it back per file)
if (process.env['TEST_DB_URI'] === undefined) {
  const containerReachable = await isTestContainerReachable();

  const baseURI = containerReachable
    ? `postgres://test:test@localhost:${TEST_CONTAINER_PORT}`
    : await startPostgresContainer();

  const templateDB =
    process.env['TEST_TEMPLATE_DB'] ?? buildTestTemplateDBName(readCurrentBranch());

  await createTestTemplate({ baseURI, templateDB });

  process.env['TEST_DB_URI'] = baseURI;
  process.env['TEST_TEMPLATE_DB'] = templateDB;
}

/**
 * Starts a fresh postgres test container for a bare `bun test` run against a
 * machine with no container listening yet — CI and local development both
 * start one ahead of time with `pg:test-container:start`, so this path is
 * otherwise unexercised. The container's own bootstrap database is never
 * migrated or cloned from — every worktree provisions its own branch-scoped
 * template inside the container instead.
 */
async function startPostgresContainer(): Promise<string> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:16.2-alpine3.19',
  )
    .withDatabase(TEST_TEMPLATE_DB)
    .withUsername('test')
    .withPassword('test')
    .withTmpFs({ '/var/lib/pg/data': 'rw' })
    .withEnvironment({ PGDATA: '/var/lib/pg/data' })
    .withExposedPorts({ container: 5432, host: TEST_CONTAINER_PORT })
    .withReuse()
    .start();

  return `postgres://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getFirstMappedPort()}`;
}
