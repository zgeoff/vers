import {
  createTestTemplate,
  isTestContainerReachable,
  resolveTestDBTarget,
} from '@vers/db/test-support';
import { createPostgresContainer, getContainerConnectionURI } from '@vers/service-test-utils';

const target = resolveTestDBTarget();

// testcontainers reuses a container only when its config hash matches, and a testcontainers
// upgrade changes the hash; a second container then cannot bind the fixed port the first holds,
// and start() times out waiting for the port binding
const isReachable = await isTestContainerReachable();

let baseURI = target.baseURI;

if (!isReachable) {
  const container = await createPostgresContainer();

  baseURI = getContainerConnectionURI(container);
}

await createTestTemplate({ baseURI, templateDB: target.templateDB });

console.log(`⚡ postgres test container ready (template: ${target.templateDB})`);

// testcontainers' reaper socket stays open by design, and bun does not unref
// it the way node does — without an explicit exit the process hangs forever
process.exit(0);
