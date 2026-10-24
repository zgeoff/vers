import {
  buildTestTemplateDBName,
  createTestTemplate,
  isTestContainerReachable,
  readCurrentBranch,
  removeOrphanedClones,
} from '@vers/db/test-support';
import { createPostgresContainer } from '../create-postgres-container';
import { getContainerConnectionURI } from '../get-container-connection-uri';
import { resolveTestDBTarget } from './resolve-test-db-target';

export async function setupBunTestDB(): Promise<void> {
  if (process.env['TEST_DB_URI'] === undefined) {
    await prepareTestTemplate();
  }

  // a worker keeps its clones across its files: under `--parallel` an `afterAll` runs after every
  // file and would drop a clone a module still holds, so the clones of ended runs are dropped here
  await removeOrphanedClones(resolveTestDBTarget().baseURI);
}

const TEST_CONTAINER_PORT = 32_999;

async function prepareTestTemplate(): Promise<void> {
  const containerReachable = await isTestContainerReachable();

  let baseURI: string;

  // Short-circuits whenever the container is already reachable, since CI always starts it with
  // `pg:test-container:start` first and testcontainers under bun is otherwise unproven.
  if (containerReachable) {
    baseURI = `postgres://test:test@localhost:${TEST_CONTAINER_PORT}`;
  } else {
    const container = await createPostgresContainer();

    baseURI = getContainerConnectionURI(container);
  }

  const templateDB =
    process.env['TEST_TEMPLATE_DB'] ?? buildTestTemplateDBName(readCurrentBranch());

  await createTestTemplate({ baseURI, templateDB });

  process.env['TEST_DB_URI'] = baseURI;
  process.env['TEST_TEMPLATE_DB'] = templateDB;
}
