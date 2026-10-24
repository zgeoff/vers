import '@zgeoff/bun-test-extended';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { registerBunTestCleanup } from '@vers/test-utils/bun';
import { buildTestTemplateDBName } from './src/test-support/build-test-template-db-name';
import { createTestTemplate } from './src/test-support/create-test-template';
import { isTestContainerReachable } from './src/test-support/is-test-container-reachable';
import { readCurrentBranch } from './src/test-support/read-current-branch';
import { removeOrphanedClones } from './src/test-support/remove-orphaned-clones';
import { resolveTestDBTarget } from './src/test-support/resolve-test-db-target';

registerBunTestCleanup();

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

// a worker keeps its clones across its files: under `--parallel` an `afterAll` runs after every
// file and would drop a clone a module still holds, so the clones of ended runs are dropped here
await removeOrphanedClones(resolveTestDBTarget().baseURI);

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
