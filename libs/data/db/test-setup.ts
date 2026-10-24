import '@zgeoff/bun-test-extended';
import { afterAll } from 'bun:test';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { registerBunTestCleanup } from '@vers/test-utils/bun';
import { buildTestTemplateDBName } from './src/test-support/build-test-template-db-name';
import { CLONED_DATABASE_REMOVAL_TIMEOUT_MS } from './src/test-support/cloned-database-removal-timeout-ms';
import { createTestTemplate } from './src/test-support/create-test-template';
import { isTestContainerReachable } from './src/test-support/is-test-container-reachable';
import { readCurrentBranch } from './src/test-support/read-current-branch';
import { removeClonedDatabases } from './src/test-support/remove-cloned-databases';

registerBunTestCleanup();
afterAll(removeClonedDatabases, CLONED_DATABASE_REMOVAL_TIMEOUT_MS);

const TEST_CONTAINER_PORT = 32_999;
const TEST_TEMPLATE_DB = 'test_template';

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
