import { connect } from 'node:net';
import { createPostgresContainer } from '../create-postgres-container';
import { getContainerConnectionURI } from '../get-container-connection-uri';
import { setupTestDB } from '../setup-test-db';

const TEST_CONTAINER_PORT = 32_999;
const TEST_TEMPLATE_DB = 'test_template';

/**
 * Publishes the shared postgres test container's connection details as
 * `TEST_DB_URI`/`TEST_TEMPLATE_DB` env vars for bun-test files to read (a
 * bun-test file's preload runs once per file's process, so `inject`-style
 * handoff isn't available). Starts (or attaches to) the reused container —
 * short-circuiting whenever the container is already reachable, since CI
 * always starts it with `pg:test-container:start` first and testcontainers
 * under bun is otherwise unproven.
 */
export async function setupBunTestDB(): Promise<void> {
  if (process.env['TEST_DB_URI'] !== undefined) {
    return;
  }

  if (await isTestContainerReachable()) {
    process.env['TEST_DB_URI'] = `postgres://test:test@localhost:${TEST_CONTAINER_PORT}`;
    process.env['TEST_TEMPLATE_DB'] = TEST_TEMPLATE_DB;

    return;
  }

  const container = await createPostgresContainer();

  await setupTestDB(container);

  process.env['TEST_DB_URI'] = getContainerConnectionURI(container);
  process.env['TEST_TEMPLATE_DB'] = container.getDatabase();
}

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
