import {
  buildTestTemplateDBName,
  createTestTemplate,
  isTestContainerReachable,
  readCurrentBranch,
} from '@vers/db/test-support';
import { createPostgresContainer } from '../create-postgres-container';
import { getContainerConnectionURI } from '../get-container-connection-uri';

const TEST_CONTAINER_PORT = 32_999;

export async function setupBunTestDB(): Promise<void> {
  if (process.env['TEST_DB_URI'] !== undefined) {
    return;
  }

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
