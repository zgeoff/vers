import {
  buildTestTemplateDBName,
  isTestContainerReachable,
  provisionTestTemplate,
  readCurrentBranch,
} from '@vers/db/test-support';
import { createPostgresContainer } from '../create-postgres-container';
import { getContainerConnectionURI } from '../get-container-connection-uri';

const TEST_CONTAINER_PORT = 32_999;

/**
 * Publishes the shared postgres test container's connection details as
 * `TEST_DB_URI`/`TEST_TEMPLATE_DB` env vars for bun-test files to read (a
 * bun-test file's preload runs once per file's process, so `inject`-style
 * handoff isn't available). Starts (or attaches to) the reused container —
 * short-circuiting whenever the container is already reachable, since CI
 * always starts it with `pg:test-container:start` first and testcontainers
 * under bun is otherwise unproven — then provisions this worktree's
 * branch-scoped template.
 */
export async function setupBunTestDB(): Promise<void> {
  if (process.env['TEST_DB_URI'] !== undefined) {
    return;
  }

  const containerReachable = await isTestContainerReachable();

  let baseURI: string;

  if (containerReachable) {
    baseURI = `postgres://test:test@localhost:${TEST_CONTAINER_PORT}`;
  } else {
    const container = await createPostgresContainer();

    baseURI = getContainerConnectionURI(container);
  }

  const templateDB =
    process.env['TEST_TEMPLATE_DB'] ?? buildTestTemplateDBName(readCurrentBranch());

  await provisionTestTemplate({ baseURI, templateDB });

  process.env['TEST_DB_URI'] = baseURI;
  process.env['TEST_TEMPLATE_DB'] = templateDB;
}
